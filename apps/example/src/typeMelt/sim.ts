// The one entry point the screen drives: step, destroy, rebuild, switch mode,
// and publish the state into value slots and the sprite buffer.
import { SPRITE_FLOATS } from 'react-native-tgfx';
import { destroyExplode, stepExplode } from './explode';
import { destroyFall, stepFall } from './fall';
import { writeMesh } from './meshMelt';
import { writeRibbon } from './ribbon';
import { destroyMelt, stepMelt } from './melt';
import {
  BLOB,
  CHAIN,
  LETTERS,
  MAX_DT,
  MODE_EXPLODE,
  MODE_MELT,
  PHASE_DESTROYED,
  PHASE_INTACT,
  PHASE_REBUILDING,
  POOL_BASE,
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
  ribbon: Float32Array,
  opacity: Value,
  count: Value,
  melt: Value,
  stamp: number,
): void {
  'worklet';
  // Pack only visible sprites: parked chains on dry anchors are hundreds of
  // zero-size sprites the renderer would otherwise still walk every frame.
  // In melt mode the strands are drawn by the ribbon mesh: as sprites, only
  // the bulbous drip heads and the puddle drops.
  writeRibbon(s, ribbon);
  const melting = s.mode === MODE_MELT;
  let live = 0;
  for (let i = 0; i < s.n; i++) {
    if (s.r[i]! <= 0) {
      continue;
    }
    if (melting && i < POOL_BASE && i % CHAIN !== CHAIN - 1) {
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
