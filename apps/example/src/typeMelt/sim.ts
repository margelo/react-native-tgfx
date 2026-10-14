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

export function step(s: SimState, dt: number): void {
  'worklet';
  // A backgrounded app or a GC pause hands us seconds; never integrate more than a frame at 30 fps.
  const h = dt > 0 ? Math.min(dt, MAX_DT) : 0;
  s.t += h;
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
  if (s.pendingMode !== s.mode) {
    return;
  }
  if (s.mode === MODE_MELT) {
    destroyMelt(s, imp);
  } else if (s.mode === MODE_EXPLODE) {
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
  stamp: number,
): void {
  'worklet';
  for (let i = 0; i < s.n; i++) {
    const o = i * SPRITE_FLOATS;
    f[o + 4] = s.r[i]! / (BLOB / 2);
    f[o + 5] = s.px[i]!;
    f[o + 6] = s.py[i]!;
  }
  for (let i = 0; i < LETTERS; i++) {
    const l = letters[i]!;
    l.x.value = s.lx[i]!;
    l.y.value = s.ly[i]!;
    l.rot.value = s.la[i]!;
    l.sx.value = 1 + SPREAD * (1 - s.lsy[i]!);
    l.sy.value = s.lsy[i]!;
  }
  opacity.value = s.letterOpacity;
  // Reanimated drops same-value writes, so a constant count would never wake the
  // renderer after a buffer refill; the fraction truncates natively.
  count.value = s.n + (stamp % 1000) * 1e-6;
}
