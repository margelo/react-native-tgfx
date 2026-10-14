// apps/example/src/typeMelt/springHome.ts
// Rebuild motion shared by every mode: critically damped springs toward home.
import { LETTERS, type SimState } from './state';

export const SPRING_W = 10;

/** One critically damped spring step on p[i]/v[i]; returns the remaining |error|. */
export function springTo(
  p: Float32Array,
  v: Float32Array,
  i: number,
  target: number,
  dt: number,
): number {
  'worklet';
  const a = SPRING_W * SPRING_W * (target - p[i]!) - 2 * SPRING_W * v[i]!;
  v[i] = v[i]! + a * dt;
  p[i] = p[i]! + v[i]! * dt;
  return Math.abs(target - p[i]!);
}

export function wrapAngle(a: number): number {
  'worklet';
  return a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
}

/** Springs every letter home, upright and unsagged; returns the worst error in points. */
export function springLetters(s: SimState, dt: number): number {
  'worklet';
  const w = s.word;
  let err = 0;
  for (let i = 0; i < LETTERS; i++) {
    s.la[i] = wrapAngle(s.la[i]!);
    err = Math.max(err, springTo(s.lx, s.lvx, i, w.cx[i]!, dt));
    err = Math.max(err, springTo(s.ly, s.lvy, i, w.cy[i]!, dt));
    err = Math.max(err, springTo(s.la, s.lva, i, 0, dt) * w.h[i]!);
    err = Math.max(err, springTo(s.lsy, s.lvsy, i, 1, dt) * w.h[i]!);
  }
  return err;
}

/** Springs sprites 0..count-1 to their droplet homes; returns the worst error in points. */
export function springSprites(s: SimState, dt: number, count: number): number {
  'worklet';
  const homes = s.word.homes;
  let err = 0;
  for (let i = 0; i < count; i++) {
    err = Math.max(err, springTo(s.px, s.vx, i, homes[i * 2]!, dt));
    err = Math.max(err, springTo(s.py, s.vy, i, homes[i * 2 + 1]!, dt));
  }
  return err;
}
