// Melt: Verlet drip chains hang from anchors on the letters' bottom edges,
// lengthen at a per-anchor rate, and pool on the floor.
import {
  ANCHORS_PER_LETTER,
  CHAIN,
  GRAVITY,
  LETTERS,
  MAX_ANCHORS,
  PHASE_DESTROYED,
  PHASE_REBUILDING,
  distToSegment,
  finishRebuild,
  letterPoint,
  nodeRadius,
  type Impulse,
  type SimState,
} from './state';

/** How far the letters squash while melted. */
export const SAG = 0.86;
/** Verlet velocity kept per 1/60 s: honey, not water. */
const VISCOUS = 0.94;
/** While intact, drips hang this share of the gap to the floor. */
const INTACT_REACH = 0.35;
/** How fast a swipe's speed-up wears off, per second. */
const BOOST_DECAY = 1.5;

export function destroyMelt(s: SimState, imp: Impulse): void {
  'worklet';
  s.phase = PHASE_DESTROYED;
  const w = s.word;
  const reach = 1.5 * w.fontSize;
  for (let a = 0; a < MAX_ANCHORS; a++) {
    const ax = w.anchors[a * 2]!;
    if (Number.isNaN(ax)) {
      continue;
    }
    letterPoint(
      s,
      (a / ANCHORS_PER_LETTER) | 0,
      ax,
      w.anchors[a * 2 + 1]!,
      s.tmp,
    );
    if (distToSegment(s.tmp[0]!, s.tmp[1]!, imp) < reach) {
      s.boost[a] = s.boost[a]! + 1 + imp.speed / 800;
    }
  }
}

export function stepMelt(s: SimState, dt: number): void {
  'worklet';
  const w = s.word;
  const rebuilding = s.phase === PHASE_REBUILDING;
  const destroyed = s.phase === PHASE_DESTROYED;
  let settled = true;
  for (let i = 0; i < LETTERS; i++) {
    const target = destroyed ? SAG : 1;
    s.lsy[i] =
      s.lsy[i]! +
      (target - s.lsy[i]!) * Math.min(1, dt * (rebuilding ? 4 : 0.8));
    if (rebuilding && Math.abs(s.lsy[i]! - 1) < 0.002) {
      s.lsy[i] = 1;
    }
    settled = settled && s.lsy[i] === 1;
    // Squash about the bottom edge, not the centre.
    s.ly[i] = w.cy[i]! + (w.h[i]! / 2) * (1 - s.lsy[i]!);
  }
  const R = w.dropR * 1.6;
  const keep = Math.pow(VISCOUS, dt * 60);
  const g = GRAVITY * 0.35 * dt * dt;
  for (let a = 0; a < MAX_ANCHORS; a++) {
    const ax = w.anchors[a * 2]!;
    if (Number.isNaN(ax)) {
      continue;
    }
    const base = a * CHAIN;
    letterPoint(
      s,
      (a / ANCHORS_PER_LETTER) | 0,
      ax,
      w.anchors[a * 2 + 1]!,
      s.tmp,
    );
    const gap = w.floorY - s.tmp[1]!;
    if (rebuilding) {
      s.stretch[a] = Math.max(0, s.stretch[a]! - (40 + s.stretch[a]! * 3) * dt);
    } else {
      const limit = destroyed ? gap * 1.2 : gap * INTACT_REACH;
      s.stretch[a] = Math.min(
        limit,
        s.stretch[a]! + s.rate[a]! * (1 + s.boost[a]! * 4) * dt,
      );
    }
    s.boost[a] = s.boost[a]! * Math.exp(-BOOST_DECAY * dt);
    settled = settled && s.stretch[a] === 0;
    const link = s.stretch[a]! / (CHAIN - 1);
    s.px[base] = s.ox[base] = s.tmp[0]!;
    s.py[base] = s.oy[base] = s.tmp[1]!;
    for (let j = 1; j < CHAIN; j++) {
      const k = base + j;
      const vx = (s.px[k]! - s.ox[k]!) * keep;
      const vy = (s.py[k]! - s.oy[k]!) * keep;
      s.ox[k] = s.px[k]!;
      s.oy[k] = s.py[k]!;
      s.px[k] = s.px[k]! + vx;
      s.py[k] = s.py[k]! + vy + g;
    }
    for (let iter = 0; iter < 3; iter++) {
      for (let j = 1; j < CHAIN; j++) {
        const k = base + j;
        const dx = s.px[k]! - s.px[k - 1]!;
        const dy = s.py[k]! - s.py[k - 1]!;
        const d = Math.hypot(dx, dy);
        if (d > link) {
          const f = d > 1e-6 ? link / d : 0;
          s.px[k] = s.px[k - 1]! + dx * f;
          s.py[k] = s.py[k - 1]! + dy * f;
        }
        const rr = nodeRadius(R, j);
        if (s.py[k]! > w.floorY - rr) {
          s.py[k] = w.floorY - rr;
          s.oy[k] = s.py[k]!;
          s.ox[k] = s.px[k]! - (s.px[k]! - s.ox[k]!) * 0.9;
        }
      }
    }
  }
  if (rebuilding && settled) {
    finishRebuild(s);
  }
}
