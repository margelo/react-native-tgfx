// The one entry point the screen drives: step, destroy, rebuild, switch mode,
// and publish the state into value slots and the sprite buffer.
import { SPRITE_FLOATS } from 'react-native-tgfx';
import { destroyExplode, stepExplode } from './explode';
import { destroyFall, stepFall } from './fall';
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
  SPREAD,
  type Impulse,
  type SimState,
} from './state';

/** Structurally a Reanimated SharedValue<number>; plain objects in tests. */
export interface Value {
  value: number;
}

export interface LetterValues {
  x: Value;
  y: Value;
  rot: Value;
  sx: Value;
  sy: Value;
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
    if (s.lsy[i] !== 0) {
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
  letters: LetterValues[],
  opacity: Value,
  count: Value,
  melt: Value,
  stamp: number,
): void {
  'worklet';
  for (let i = 0; i < s.n; i++) {
    const o = i * SPRITE_FLOATS;
    f[o + 4] = s.r[i]! / (BLOB / 2);
    f[o + 5] = s.px[i]!;
    f[o + 6] = s.py[i]!;
  }
  let melted = 0;
  for (let i = 0; i < LETTERS; i++) {
    melted += 1 - s.lsy[i]!;
    const l = letters[i]!;
    l.x.value = s.lx[i]!;
    l.y.value = s.ly[i]!;
    l.rot.value = s.la[i]!;
    l.sx.value = 1 + SPREAD * (1 - s.lsy[i]!);
    l.sy.value = s.lsy[i]!;
  }
  opacity.value = s.letterOpacity;
  // How melted the word is overall, 0..1: softens the height field's blur.
  melt.value = melted / LETTERS;
  // Reanimated drops same-value writes, so a constant count would never wake the
  // renderer after a buffer refill; the fraction truncates natively.
  count.value = s.n + (stamp % 1000) * 1e-6;
}
