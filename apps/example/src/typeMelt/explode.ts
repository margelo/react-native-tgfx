// Explode: the letters become droplets at their sampled homes and fly.
import { springSprites } from './springHome';
import {
  GRAVITY,
  LETTERS,
  PHASE_DESTROYED,
  PHASE_INTACT,
  PHASE_REBUILDING,
  collideBounds,
  finishRebuild,
  nextRand,
  type Impulse,
  type SimState,
} from './state';

/** Air drag, per second. */
const DRAG = 0.6;
/** Share of the swipe's speed handed to the droplets nearest its end. */
const KICK = 0.9;
/** How far the kick reaches, in font sizes. */
const REACH = 0.9;
/** Every droplet's own outward burst, points/s, whatever the swipe. */
const BURST = 250;
/** Airborne droplets fall slower than the rigid letters, so the spray reads. */
const DROP_GRAVITY = GRAVITY * 0.5;

export function destroyExplode(s: SimState, imp: Impulse): void {
  'worklet';
  const w = s.word;
  if (s.phase === PHASE_INTACT) {
    s.n = w.homeCount;
    for (let i = 0; i < s.n; i++) {
      s.px[i] = w.homes[i * 2]!;
      s.py[i] = w.homes[i * 2 + 1]!;
      s.vx[i] = 0;
      s.vy[i] = 0;
      s.r[i] = w.dropR;
    }
  }
  s.phase = PHASE_DESTROYED;
  s.letterOpacity = 0;
  const len = Math.hypot(imp.ex - imp.sx, imp.ey - imp.sy);
  const dx = len > 1e-3 ? (imp.ex - imp.sx) / len : 0;
  const dy = len > 1e-3 ? (imp.ey - imp.sy) / len : 0;
  const reach = REACH * w.fontSize;
  for (let i = 0; i < s.n; i++) {
    // Burst away from the centre of the nearest letter.
    let best = 0;
    for (let l = 1; l < LETTERS; l++) {
      if (Math.abs(s.px[i]! - w.cx[l]!) < Math.abs(s.px[i]! - w.cx[best]!)) {
        best = l;
      }
    }
    const bx = s.px[i]! - w.cx[best]!;
    const by = s.py[i]! - w.cy[best]! - w.h[best]! * 0.3;
    const bd = Math.hypot(bx, by) + 1e-3;
    const burst = BURST * (0.5 + nextRand(s));
    s.vx[i] = s.vx[i]! + (bx / bd) * burst;
    s.vy[i] = s.vy[i]! + (by / bd) * burst;
    const rx = s.px[i]! - imp.ex;
    const ry = s.py[i]! - imp.ey;
    const d = Math.hypot(rx, ry) + 1e-3;
    const kick = imp.speed * KICK * Math.exp(-d / reach);
    // Half along the swipe, half away from where it ended, a little upward lift and scatter.
    s.vx[i] =
      s.vx[i]! +
      kick * (0.5 * dx + (0.5 * rx) / d) +
      (nextRand(s) - 0.5) * kick * 0.3;
    s.vy[i] =
      s.vy[i]! +
      kick * (0.5 * dy + (0.5 * ry) / d) +
      (nextRand(s) - 0.5) * kick * 0.3 -
      kick * 0.2;
  }
}

export function stepExplode(s: SimState, dt: number): void {
  'worklet';
  if (s.phase === PHASE_INTACT) {
    return;
  }
  if (s.phase === PHASE_REBUILDING) {
    if (springSprites(s, dt, s.n) < 0.5) {
      s.letterOpacity = Math.min(1, s.letterOpacity + dt * 4);
      if (s.letterOpacity >= 1) {
        finishRebuild(s);
      }
    }
    return;
  }
  const drag = Math.exp(-DRAG * dt);
  for (let i = 0; i < s.n; i++) {
    s.vy[i] = (s.vy[i]! + DROP_GRAVITY * dt) * drag;
    s.vx[i] = s.vx[i]! * drag;
    s.px[i] = s.px[i]! + s.vx[i]! * dt;
    s.py[i] = s.py[i]! + s.vy[i]! * dt;
    collideBounds(s, i);
  }
}
