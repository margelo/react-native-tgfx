// Melt: Verlet drip chains hang from anchors on the letters' bottom edges and
// lengthen at a per-anchor rate. Once destroyed, the letters keep softening
// until they lie flat on the floor: their melted volume and every drip that
// lands feed a puddle that spreads as it grows.
import {
  ANCHORS_PER_LETTER,
  CHAIN,
  GRAVITY,
  LETTERS,
  MAX_ANCHORS,
  PHASE_DESTROYED,
  PHASE_REBUILDING,
  POOL_BASE,
  POOL_CAP,
  SPREAD,
  distToSegment,
  finishRebuild,
  letterPoint,
  nextRand,
  nodeRadius,
  type Impulse,
  type SimState,
} from './state';

/** Melt speed in letter heights per second: slow at first, faster as the letter softens. */
const MELT_START = 0.05;
const MELT_ACCEL = 0.15;
/** Puddle drops one whole letter's volume makes. */
const DROPS_PER_LETTER = 40;
/** The largest a puddle drop grows, in drip radii. */
const POOL_MAX = 2.2;
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

/** Adds a puddle drop at x, or swells an existing one when the puddle is full. */
function spawnPool(s: SimState, x: number, R: number): void {
  'worklet';
  if (s.poolN >= POOL_CAP) {
    const k = POOL_BASE + ((nextRand(s) * POOL_CAP) | 0);
    s.r[k] = Math.min(R * POOL_MAX, s.r[k]! + R * 0.1);
    return;
  }
  const k = POOL_BASE + s.poolN;
  s.poolN++;
  s.px[k] = x;
  s.vx[k] = (nextRand(s) - 0.5) * 60;
  s.r[k] = R * (0.8 + 0.4 * nextRand(s));
  s.py[k] = s.word.floorY - s.r[k]! * 0.55;
}

export function stepMelt(s: SimState, dt: number): void {
  'worklet';
  const w = s.word;
  const rebuilding = s.phase === PHASE_REBUILDING;
  const destroyed = s.phase === PHASE_DESTROYED;
  const R = w.dropR * 1.2;
  let settled = true;
  for (let i = 0; i < LETTERS; i++) {
    if (destroyed) {
      let boost = 0;
      for (
        let a = i * ANCHORS_PER_LETTER;
        a < (i + 1) * ANCHORS_PER_LETTER;
        a++
      ) {
        boost = Math.max(boost, s.boost[a]!);
      }
      const rate = (MELT_START + MELT_ACCEL * (1 - s.lsy[i]!)) * (1 + boost);
      const before = s.lsy[i]!;
      s.lsy[i] = Math.max(0, before - rate * dt);
      s.emitAcc[i] = s.emitAcc[i]! + (before - s.lsy[i]!) * DROPS_PER_LETTER;
      while (s.emitAcc[i]! >= 1) {
        s.emitAcc[i] = s.emitAcc[i]! - 1;
        const spread = w.w[i]! * (1 + SPREAD * (1 - s.lsy[i]!));
        spawnPool(s, s.lx[i]! + (nextRand(s) - 0.5) * spread, R);
      }
    } else if (rebuilding) {
      s.lsy[i] = s.lsy[i]! + (1 - s.lsy[i]!) * Math.min(1, dt * 3);
      if (Math.abs(s.lsy[i]! - 1) < 0.002) {
        s.lsy[i] = 1;
      }
    }
    settled = settled && s.lsy[i] === 1;
    // Slump onto the floor: the bottom edge slides from where it stood down
    // to the floor while the letter flattens.
    const bottom = w.cy[i]! + w.h[i]! / 2;
    s.ly[i] =
      bottom +
      (w.floorY - bottom) * (1 - s.lsy[i]!) -
      (w.h[i]! / 2) * s.lsy[i]!;
  }
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
    const gap = Math.max(0, w.floorY - s.tmp[1]!);
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
    s.py[base] = s.oy[base] = Math.min(s.tmp[1]!, w.floorY - nodeRadius(R, 0));
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
    // A stream that has reached the floor keeps feeding the puddle: each drop
    // it hands over shortens it by one link, and the anchor keeps lengthening it.
    const head = base + CHAIN - 1;
    if (
      destroyed &&
      s.stretch[a]! > gap &&
      s.py[head]! >= w.floorY - nodeRadius(R, CHAIN - 1) - 0.5
    ) {
      spawnPool(s, s.px[head]!, R);
      s.stretch[a] = Math.max(0, s.stretch[a]! - link);
    }
  }
  for (let k = POOL_BASE; k < POOL_BASE + s.poolN; k++) {
    if (rebuilding) {
      s.r[k] = Math.max(0, s.r[k]! - R * 1.5 * dt);
    } else {
      s.vx[k] = s.vx[k]! * Math.exp(-3 * dt);
      s.r[k] = Math.min(R * POOL_MAX, s.r[k]! + R * 0.15 * dt);
    }
    const r = s.r[k]!;
    s.px[k] = Math.min(w.width - r, Math.max(r, s.px[k]! + s.vx[k]! * dt));
    // Sunk a little into the floor, so the puddle reads flat.
    s.py[k] = w.floorY - r * 0.55;
  }
  if (rebuilding) {
    let drained = true;
    for (let k = POOL_BASE; k < POOL_BASE + s.poolN; k++) {
      drained = drained && s.r[k] === 0;
    }
    if (drained) {
      s.poolN = 0;
    }
  }
  s.n = POOL_BASE + s.poolN;
  if (rebuilding && settled && s.poolN === 0) {
    finishRebuild(s);
  }
}
