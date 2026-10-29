// Fall: each letter is a unit-mass rigid body whose collision shape is a few
// circles along its ink. Impulse-based contacts against floor, walls and each other.
import { springLetters } from './springHome';
import {
  CIRCLES_PER_LETTER,
  GRAVITY,
  LETTERS,
  PHASE_DESTROYED,
  PHASE_INTACT,
  PHASE_REBUILDING,
  distToSegment,
  finishRebuild,
  letterPoint,
  type Impulse,
  type SimState,
} from './state';

const SUBSTEPS = 3;
/** Contact solve passes per substep: one pass leaves a resting pile jittering. */
const ITERATIONS = 4;
const RESTITUTION = 0.2;
/** Contacts closing slower than this (pt/s) are resting: no bounce, or a pile never settles. */
const REST_SPEED = 60;
const FRICTION = 0.5;
/** Share of the swipe's speed given to each letter it crosses. */
const HIT = 0.6;
/** Angular damping, per second. */
const SPIN_DAMP = 0.6;
/** Linear damping, per second — lets a pile come to rest. */
const DAMP = 0.4;

function inertia(s: SimState, i: number): number {
  'worklet';
  const w = s.word.w[i]!;
  const h = s.word.h[i]!;
  return (w * w + h * h) / 12;
}

function applyImpulse(
  s: SimState,
  i: number,
  px: number,
  py: number,
  jx: number,
  jy: number,
): void {
  'worklet';
  s.lvx[i] = s.lvx[i]! + jx;
  s.lvy[i] = s.lvy[i]! + jy;
  const rx = px - s.lx[i]!;
  const ry = py - s.ly[i]!;
  s.lva[i] = s.lva[i]! + (rx * jy - ry * jx) / inertia(s, i);
}

function pointVelocity(
  s: SimState,
  i: number,
  px: number,
  py: number,
  out: Float32Array,
): void {
  'worklet';
  out[0] = s.lvx[i]! - s.lva[i]! * (py - s.ly[i]!);
  out[1] = s.lvy[i]! + s.lva[i]! * (px - s.lx[i]!);
}

/** Letter i touching a fixed surface at (px, py); n points out of the surface. */
function contactStatic(
  s: SimState,
  i: number,
  px: number,
  py: number,
  nx: number,
  ny: number,
  pen: number,
): void {
  'worklet';
  s.lx[i] = s.lx[i]! + nx * pen;
  s.ly[i] = s.ly[i]! + ny * pen;
  pointVelocity(s, i, px, py, s.tmpA);
  const vn = s.tmpA[0]! * nx + s.tmpA[1]! * ny;
  if (vn >= 0) {
    return;
  }
  const I = inertia(s, i);
  const rx = px - s.lx[i]!;
  const ry = py - s.ly[i]!;
  const rn = rx * ny - ry * nx;
  const e = vn < -REST_SPEED ? RESTITUTION : 0;
  const jn = (-(1 + e) * vn) / (1 + (rn * rn) / I);
  const tx = -ny;
  const ty = nx;
  const vt = s.tmpA[0]! * tx + s.tmpA[1]! * ty;
  const rt = rx * ty - ry * tx;
  const jt = Math.max(
    -FRICTION * jn,
    Math.min(FRICTION * jn, -vt / (1 + (rt * rt) / I)),
  );
  applyImpulse(s, i, px, py, jn * nx + jt * tx, jn * ny + jt * ty);
}

/** Letters a and b touching at (px, py); n points from b to a. */
function contactPair(
  s: SimState,
  a: number,
  b: number,
  px: number,
  py: number,
  nx: number,
  ny: number,
  pen: number,
): void {
  'worklet';
  s.lx[a] = s.lx[a]! + nx * pen * 0.5;
  s.ly[a] = s.ly[a]! + ny * pen * 0.5;
  s.lx[b] = s.lx[b]! - nx * pen * 0.5;
  s.ly[b] = s.ly[b]! - ny * pen * 0.5;
  pointVelocity(s, a, px, py, s.tmpA);
  pointVelocity(s, b, px, py, s.tmpB);
  const vn = (s.tmpA[0]! - s.tmpB[0]!) * nx + (s.tmpA[1]! - s.tmpB[1]!) * ny;
  if (vn >= 0) {
    return;
  }
  const ra = (px - s.lx[a]!) * ny - (py - s.ly[a]!) * nx;
  const rb = (px - s.lx[b]!) * ny - (py - s.ly[b]!) * nx;
  const e = vn < -REST_SPEED ? RESTITUTION : 0;
  const jn =
    (-(1 + e) * vn) /
    (2 + (ra * ra) / inertia(s, a) + (rb * rb) / inertia(s, b));
  applyImpulse(s, a, px, py, jn * nx, jn * ny);
  applyImpulse(s, b, px, py, -jn * nx, -jn * ny);
}

export function destroyFall(s: SimState, imp: Impulse): void {
  'worklet';
  s.phase = PHASE_DESTROYED;
  const w = s.word;
  const len = Math.hypot(imp.ex - imp.sx, imp.ey - imp.sy);
  if (len < 1e-3 || imp.speed <= 0) {
    return;
  }
  const dx = (imp.ex - imp.sx) / len;
  const dy = (imp.ey - imp.sy) / len;
  for (let i = 0; i < LETTERS; i++) {
    if (
      distToSegment(s.lx[i]!, s.ly[i]!, imp) <
      Math.max(w.w[i]!, w.h[i]!) * 0.7
    ) {
      // Strike above the centre so the hit spins the letter as well as pushing it.
      applyImpulse(
        s,
        i,
        s.lx[i]!,
        s.ly[i]! - w.h[i]! * 0.25,
        dx * imp.speed * HIT,
        dy * imp.speed * HIT,
      );
    }
  }
}

export function stepFall(s: SimState, dt: number): void {
  'worklet';
  if (s.phase === PHASE_INTACT) {
    return;
  }
  if (s.phase === PHASE_REBUILDING) {
    if (springLetters(s, dt) < 0.5) {
      finishRebuild(s);
    }
    return;
  }
  const w = s.word;
  const h = dt / SUBSTEPS;
  const spin = Math.exp(-SPIN_DAMP * h);
  const damp = Math.exp(-DAMP * h);
  const C = CIRCLES_PER_LETTER;
  for (let sub = 0; sub < SUBSTEPS; sub++) {
    for (let i = 0; i < LETTERS; i++) {
      s.lvy[i] = (s.lvy[i]! + GRAVITY * h) * damp;
      s.lvx[i] = s.lvx[i]! * damp;
      s.lva[i] = s.lva[i]! * spin;
      s.lx[i] = s.lx[i]! + s.lvx[i]! * h;
      s.ly[i] = s.ly[i]! + s.lvy[i]! * h;
      s.la[i] = s.la[i]! + s.lva[i]! * h;
    }
    for (let it = 0; it < ITERATIONS; it++) {
      for (let i = 0; i < LETTERS; i++) {
        for (let k = 0; k < C; k++) {
          const c = i * C + k;
          letterPoint(s, i, w.circles[c * 2]!, w.circles[c * 2 + 1]!, s.tmp);
          s.cwx[c] = s.tmp[0]!;
          s.cwy[c] = s.tmp[1]!;
        }
      }
      for (let i = 0; i < LETTERS; i++) {
        const r = w.circleR[i]!;
        for (let k = 0; k < C; k++) {
          const c = i * C + k;
          const floorPen = s.cwy[c]! + r - w.floorY;
          if (floorPen > 0) {
            contactStatic(s, i, s.cwx[c]!, s.cwy[c]! + r, 0, -1, floorPen);
          }
          const leftPen = r - s.cwx[c]!;
          if (leftPen > 0) {
            contactStatic(s, i, s.cwx[c]! - r, s.cwy[c]!, 1, 0, leftPen);
          }
          const rightPen = s.cwx[c]! + r - w.width;
          if (rightPen > 0) {
            contactStatic(s, i, s.cwx[c]! + r, s.cwy[c]!, -1, 0, rightPen);
          }
        }
      }
      for (let a = 0; a < LETTERS; a++) {
        for (let b = a + 1; b < LETTERS; b++) {
          const rr = w.circleR[a]! + w.circleR[b]!;
          for (let k = 0; k < C; k++) {
            for (let m = 0; m < C; m++) {
              const ca = a * C + k;
              const cb = b * C + m;
              const dx = s.cwx[ca]! - s.cwx[cb]!;
              const dy = s.cwy[ca]! - s.cwy[cb]!;
              const d = Math.hypot(dx, dy);
              if (d < rr && d > 1e-6) {
                contactPair(
                  s,
                  a,
                  b,
                  (s.cwx[ca]! + s.cwx[cb]!) / 2,
                  (s.cwy[ca]! + s.cwy[cb]!) / 2,
                  dx / d,
                  dy / d,
                  rr - d,
                );
              }
            }
          }
        }
      }
    }
  }
}
