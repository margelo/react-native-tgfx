// The one entry point the screen drives: step, destroy, rebuild, switch mode,
// and publish the state into value slots and the sprite buffer.
import { SPRITE_FLOATS } from 'react-native-tgfx';
import { destroyExplode, stepExplode } from './explode';
import { destroyFall, stepFall } from './fall';
import { writeMesh } from './meshMelt';
import { destroyMelt, stepMelt } from './melt';
import {
  BLOB,
  LETTERS,
  MAX_DT,
  MODE_EXPLODE,
  MODE_MELT,
  PHASE_DESTROYED,
  PHASE_INTACT,
  PHASE_REBUILDING,
  type Impulse,
  type SimState,
} from './state';

/** Structurally a Reanimated SharedValue<number>; plain objects in tests. */
export interface Value {
  value: number;
}

/** Seconds the word stands before it starts to melt by itself. */
const MELT_AFTER = 1.5;
/** Seconds the puddle lies flat before the word rebuilds and melts again. */
const HOLD_PUDDLE = 2;

// Declared before `step`: the worklets plugin turns these into variables, so
// they are not hoisted.
/** Melt mode needs no swipe: it melts, lies flat a moment, rebuilds, and loops. */
function autoMelt(s: SimState, dt: number): void {
  'worklet';
  if (s.phase === PHASE_INTACT && s.phaseT >= MELT_AFTER) {
    destroyMelt(s, { sx: 0, sy: 0, ex: 0, ey: 0, speed: 0 });
    return;
  }
  if (s.phase !== PHASE_DESTROYED) {
    return;
  }
  for (let i = 0; i < LETTERS; i++) {
    // 97%: the last few column tails are invisible, waiting for them dragged.
    if (s.melted[i]! < 0.97) {
      s.flatT = 0;
      return;
    }
  }
  s.flatT += dt;
  if (s.flatT >= HOLD_PUDDLE) {
    s.phase = PHASE_REBUILDING;
  }
}

/** Frame rates the screen can run at. 60 Hz is the default: a slow melt and
 * a swirling sheen read the same as at 120, at about half the cost; 120 Hz
 * keeps fast motion (an explode burst, a tumbling letter) at full smoothness. */
export const FRAME_RATES = [60, 120] as const;
export type FrameRate = (typeof FRAME_RATES)[number];
export const FRAME_MS = 1000 / 60;
/** Vsync timing jitters; a frame this close to due still counts. */
const FRAME_SLACK_MS = 2;

export interface Pacer {
  /** Milliseconds since the last advanced frame. */
  since: number;
  /** Where we are in the current 60 Hz slot. */
  phase: number;
}

export function createPacer(): Pacer {
  'worklet';
  return { since: 0, phase: 0 };
}

/**
 * Called every vsync with its duration; returns the seconds to advance by
 * when a slot of `frameMs` is due, else 0. Elapsed time is carried, never dropped,
 * and a long stall advances once rather than in a burst of catch-up frames.
 */
export function pace(p: Pacer, dtMs: number, frameMs = FRAME_MS): number {
  'worklet';
  p.since += dtMs;
  p.phase += dtMs;
  if (p.phase < frameMs - FRAME_SLACK_MS) {
    return 0;
  }
  p.phase -= frameMs;
  if (p.phase > frameMs) {
    p.phase = 0;
  }
  const out = p.since / 1000;
  p.since = 0;
  return out;
}

export function step(s: SimState, dt: number): void {
  'worklet';
  // A backgrounded app or a GC pause hands us seconds; never integrate more than a frame at 30 fps.
  const h = dt > 0 ? Math.min(dt, MAX_DT) : 0;
  s.t += h;
  if (s.phase !== s.lastPhase) {
    s.lastPhase = s.phase;
    s.phaseT = 0;
  }
  s.phaseT += h;
  if (s.mode === MODE_MELT && s.autoMelt && s.pendingMode === s.mode) {
    autoMelt(s, h);
  }
  if (s.mode === MODE_MELT) {
    stepMelt(s, h);
  } else if (s.mode === MODE_EXPLODE) {
    stepExplode(s, h);
  } else {
    stepFall(s, h);
  }
}

export function destroy(s: SimState, imp: Impulse): void {
  'worklet';
  // Melt runs by itself; swipes destroy only in the other modes.
  if (s.pendingMode !== s.mode || s.mode === MODE_MELT) {
    return;
  }
  if (s.mode === MODE_EXPLODE) {
    destroyExplode(s, imp);
  } else {
    destroyFall(s, imp);
  }
}

export function rebuild(s: SimState): void {
  'worklet';
  if (s.phase === PHASE_DESTROYED) {
    s.phase = PHASE_REBUILDING;
  }
}

/** Rebuilds the current mode first, so the new one always starts intact. */
export function setMode(s: SimState, mode: number): void {
  'worklet';
  s.pendingMode = mode;
  if (mode === s.mode && s.phase === PHASE_INTACT) {
    return;
  }
  s.phase = PHASE_REBUILDING;
}

export function publish(
  s: SimState,
  f: Float32Array,
  meshes: Float32Array[],
  opacity: Value,
  count: Value,
  melt: Value,
  stamp: number,
): void {
  'worklet';
  // Pack only visible sprites: parked chains on dry anchors are hundreds of
  // zero-size sprites the renderer would otherwise still walk every frame.
  let live = 0;
  for (let i = 0; i < s.n; i++) {
    if (s.r[i]! <= 0) {
      continue;
    }
    const o = live * SPRITE_FLOATS;
    f[o + 4] = s.r[i]! / (BLOB / 2);
    f[o + 5] = s.px[i]!;
    f[o + 6] = s.py[i]!;
    live++;
  }
  // Every letter is a grid over its tube image: bent in melt mode, rigid otherwise.
  let melted = 0;
  for (let i = 0; i < LETTERS; i++) {
    writeMesh(s, i, meshes[i]!);
    melted += s.mode === MODE_MELT ? s.melted[i]! : 0;
  }
  opacity.value = s.letterOpacity;
  // How melted the word is overall, 0..1: the shader softens the surface with it.
  melt.value = melted / LETTERS;
  // Reanimated drops same-value writes, so a constant count would never wake the
  // renderer after a buffer refill; the fraction truncates natively.
  count.value = live + (stamp % 1000) * 1e-6;
}
