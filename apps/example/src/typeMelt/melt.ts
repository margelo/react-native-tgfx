// Melt: the letters bend column by column (meshMelt.ts) on a melt clock until
// they lie in a puddle; rebuilding rewinds the clock. Verlet drip chains hang
// from points on the bending letters, and their landings plus the letters'
// melted volume feed a puddle of sprites that spreads as it grows.
import { meltPoint, updateMelted } from './meshMelt';
import {
  ANCHORS_PER_LETTER,
  BOTTOM_ANCHORS,
  CHAIN,
  GRAVITY,
  LETTERS,
  MAX_ANCHORS,
  PHASE_DESTROYED,
  PHASE_REBUILDING,
  POOL_BASE,
  POOL_CAP,
  distToSegment,
  finishRebuild,
  nextRand,
  nodeRadius,
  type Impulse,
  type SimState,
} from './state';

/** A rebuild rewinds a full melt in this many seconds, however long the melt took. */
const REBUILD_SECONDS = 2.5;
/** Puddle drops one whole letter's volume makes. */
const DROPS_PER_LETTER = 14;
/** A drip head resting on the floor, in drip radii. */
const FOOT = 1.5;
/** The largest a puddle drop grows, in drip radii. */
const POOL_MAX = 1.8;
/** Verlet velocity kept per 1/60 s: honey, not water. */
const VISCOUS = 0.94;
/** How fast a swipe's speed-up wears off, per second. */
const BOOST_DECAY = 0.4;

export function destroyMelt(s: SimState, imp: Impulse): void {
  'worklet';
  if (s.phase !== PHASE_DESTROYED) {
    // Liquid gathers along the top edges and starts running one stream at a
    // time; the bottom drips are already hanging, so they go at once.
    for (let a = 0; a < MAX_ANCHORS; a++) {
      const top = a % ANCHORS_PER_LETTER >= BOTTOM_ANCHORS;
      s.wait[a] = top ? 0.2 + 1.8 * nextRand(s) : 0;
      s.dropT[a] = 1.5 + 2.5 * nextRand(s);
    }
  }
  s.phase = PHASE_DESTROYED;
  const w = s.word;
  const reach = 1.5 * w.fontSize;
  for (let a = 0; a < MAX_ANCHORS; a++) {
    const ax = w.anchors[a * 2]!;
    if (Number.isNaN(ax)) {
      continue;
    }
    meltPoint(
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

/**
 * Adds a puddle drop at x, or swells an existing one when the puddle is full.
 * Given a height `y` above the floor, the drop starts there and falls.
 */
function spawnPool(s: SimState, x: number, R: number, y = -1): void {
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
  s.r[k] = R * (0.6 + 0.9 * nextRand(s));
  s.py[k] = y >= 0 ? y : s.word.floorY - s.r[k]! * 0.55;
  s.vy[k] = 0;
}

export function stepMelt(s: SimState, dt: number): void {
  'worklet';
  const w = s.word;
  const rebuilding = s.phase === PHASE_REBUILDING;
  const destroyed = s.phase === PHASE_DESTROYED;
  const R = w.dropR * 1.2;
  if (destroyed) {
    // A swipe hurries the melt along, but at most by 1.8×.
    let boost = 0;
    for (let a = 0; a < MAX_ANCHORS; a++) {
      boost = Math.max(boost, s.boost[a]!);
    }
    s.meltT = Math.min(
      s.meltEnd,
      s.meltT + dt * (1 + Math.min(boost / 4, 1) * 0.8),
    );
  } else if (rebuilding) {
    s.meltT = Math.max(0, s.meltT - (dt * s.meltEnd) / REBUILD_SECONDS);
  }
  for (let i = 0; i < LETTERS; i++) {
    s.tmpCols[i] = s.melted[i]!;
  }
  updateMelted(s);
  let settled = s.meltT === 0;
  for (let i = 0; i < LETTERS; i++) {
    if (!destroyed) {
      continue;
    }
    // Melted volume runs off into the puddle, bunched under its letter.
    const gained = Math.max(0, s.melted[i]! - s.tmpCols[i]!);
    s.emitAcc[i] = s.emitAcc[i]! + gained * DROPS_PER_LETTER;
    while (s.emitAcc[i]! >= 1) {
      s.emitAcc[i] = s.emitAcc[i]! - 1;
      const off = (nextRand(s) + nextRand(s) - 1) * w.w[i]! * 0.9;
      spawnPool(s, w.cx[i]! + off, R);
    }
  }
  const keep = Math.pow(VISCOUS, dt * 60);
  const g = GRAVITY * 0.35 * dt * dt;
  for (let a = 0; a < MAX_ANCHORS; a++) {
    const ax = w.anchors[a * 2]!;
    if (Number.isNaN(ax)) {
      continue;
    }
    const base = a * CHAIN;
    meltPoint(
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
      // While melting, only the resting drip and the top streams run: every
      // anchor at once made a wall of strands under the word.
      const top = a % ANCHORS_PER_LETTER >= BOTTOM_ANCHORS;
      const wet = top || s.reach[a]! > 0;
      const limit = destroyed ? (wet ? gap * 1.2 : 0) : gap * s.reach[a]!;
      if (destroyed && s.wait[a]! > 0) {
        s.wait[a] = s.wait[a]! - dt;
      }
      const running = !destroyed || s.wait[a]! <= 0;
      s.stretch[a] = Math.min(
        limit,
        s.stretch[a]! + (running ? s.rate[a]! * (1 + s.boost[a]! * 2) * dt : 0),
      );
    }
    s.boost[a] = s.boost[a]! * Math.exp(-BOOST_DECAY * dt);
    settled = settled && s.stretch[a] === 0;
    const link = s.stretch[a]! / (CHAIN - 1);
    // The drip travels with the bending letter: move the whole chain by
    // however far its root moved, without adding velocity.
    const rootY = Math.min(s.tmp[1]!, w.floorY - nodeRadius(R, 0));
    const mx = s.tmp[0]! - s.px[base]!;
    const my = rootY - s.py[base]!;
    for (let j = 1; j < CHAIN; j++) {
      const k = base + j;
      s.px[k] = s.px[k]! + mx;
      s.ox[k] = s.ox[k]! + mx;
      s.py[k] = s.py[k]! + my;
      s.oy[k] = s.oy[k]! + my;
    }
    s.px[base] = s.ox[base] = s.tmp[0]!;
    s.py[base] = s.oy[base] = rootY;
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
          // Shift the previous position too: a correction is not motion. A
          // strand shortened by feeding the puddle would otherwise slingshot.
          const f = d > 1e-6 ? link / d : 0;
          const cx = s.px[k - 1]! + dx * f - s.px[k]!;
          const cy = s.py[k - 1]! + dy * f - s.py[k]!;
          s.px[k] = s.px[k]! + cx;
          s.py[k] = s.py[k]! + cy;
          s.ox[k] = s.ox[k]! + cx;
          s.oy[k] = s.oy[k]! + cy;
        }
        const rr = nodeRadius(R, j);
        if (s.py[k]! > w.floorY - rr) {
          s.py[k] = w.floorY - rr;
          s.oy[k] = s.py[k]!;
          s.ox[k] = s.px[k]! - (s.px[k]! - s.ox[k]!) * 0.9;
        }
      }
    }
    // A head resting on the floor spreads into a foot, as in the reference.
    const head = base + CHAIN - 1;
    // Measured against the head's current size, so a foot stays a foot.
    const footed = s.py[head]! >= w.floorY - s.r[head]! - 0.5;
    // A drip grows out of nothing: a dry anchor draws no blob on the letter.
    const grow = Math.min(1, s.stretch[a]! / (2 * R));
    for (let j = 0; j < CHAIN - 1; j++) {
      s.r[base + j] = nodeRadius(R, j) * grow;
    }
    s.r[head] = footed ? R * FOOT : nodeRadius(R, CHAIN - 1) * grow;
    if (footed) {
      s.py[head] = s.oy[head] = w.floorY - R * FOOT;
    }
    // Spilling: a long drip that hasn't reached the floor swells and lets go
    // of a drop now and then, then pulls back up and builds the next one.
    if (destroyed && !footed && s.stretch[a]! > gap * 0.4) {
      s.dropT[a] = s.dropT[a]! - dt;
      if (s.dropT[a]! <= 0) {
        spawnPool(s, s.px[head]!, R, s.py[head]!);
        s.stretch[a] = s.stretch[a]! * 0.55;
        s.dropT[a] = 1.2 + 2.5 * nextRand(s);
      }
    }
    // A stream that has reached the floor keeps feeding the puddle: each link
    // it hands over shortens it, and the anchor keeps lengthening it.
    if (destroyed && footed && s.stretch[a]! > gap) {
      // One drop holds about 2.5 radii of strand, so not every link makes one.
      if (nextRand(s) < link / (2.5 * R)) {
        spawnPool(s, s.px[head]!, R);
      }
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
    const rest = w.floorY - r * 0.55;
    if (s.py[k]! < rest - 0.5) {
      // A falling drop: gravity until it lands, then a little splash sideways.
      s.vy[k] = s.vy[k]! + GRAVITY * dt;
      s.py[k] = s.py[k]! + s.vy[k]! * dt;
      if (s.py[k]! >= rest) {
        s.py[k] = rest;
        s.vy[k] = 0;
        s.vx[k] = s.vx[k]! + (nextRand(s) - 0.5) * 80;
      }
    } else {
      s.py[k] = rest;
    }
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
