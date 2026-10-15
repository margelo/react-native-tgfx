// Each letter is drawn as a texture-mapped grid over its tube height image, and
// this is where the grid bends. Melting is per column: heat reaches some
// columns before others, the top of each column compresses faster than its
// base, the mass settles onto the floor and spreads, and a fully melted letter
// keeps some depth as a puddle. Tuned offline first (numpy twin, video
// approved before it went in).
import {
  LETTERS,
  MELT_COLS,
  MELT_DURATION,
  MODE_MELT,
  letterPoint,
  type SimState,
} from './state';

export const MESH_COLS = 14;
export const MESH_ROWS = 20;
export const MESH_VERTS = MESH_COLS * MESH_ROWS;
export const MESH_INDICES = (MESH_COLS - 1) * (MESH_ROWS - 1) * 6;
/** A fully melted column's remaining depth, as a share of the letter's height. */
const PUDDLE_DEPTH = 0.13;
/** How far a melted base spreads past the letter's own width. */
const BASE_SPREAD = 1.4;

// Declared before its callers: the worklets plugin turns worklet functions
// into variables, so they are not hoisted.
function progressAt(s: SimState, k: number): number {
  'worklet';
  const x = Math.max(0, Math.min(1, (s.meltT - s.cstart[k]!) / MELT_DURATION));
  // Slow to start, faster as it weakens: a letter holds its shape for a while
  // before it gives way, rather than sinking at an even rate.
  return Math.pow(x * x * (3 - 2 * x), 1.6);
}

/** Fractional control-column index of letter-local x: they span 1.6× the letter. */
function columnAt(s: SimState, i: number, ax: number): number {
  'worklet';
  const f = ((ax / s.word.w[i]! + 0.8) / 1.6) * (MELT_COLS - 1);
  return Math.max(0, Math.min(MELT_COLS - 1, f));
}

/** Melt progress, 0..1, of letter i at letter-local x. */
export function columnProgress(s: SimState, i: number, ax: number): number {
  'worklet';
  const c = columnAt(s, i, ax);
  const c0 = Math.floor(c);
  const c1 = Math.min(MELT_COLS - 1, c0 + 1);
  const p0 = progressAt(s, i * MELT_COLS + c0);
  const p1 = progressAt(s, i * MELT_COLS + c1);
  return p0 + (p1 - p0) * (c - c0);
}

/** Puddle depth factor of letter i at letter-local x. */
function columnDepth(s: SimState, i: number, ax: number): number {
  'worklet';
  const c = columnAt(s, i, ax);
  const c0 = Math.floor(c);
  const c1 = Math.min(MELT_COLS - 1, c0 + 1);
  const d0 = s.cdepth[i * MELT_COLS + c0]!;
  const d1 = s.cdepth[i * MELT_COLS + c1]!;
  return d0 + (d1 - d0) * (c - c0);
}

/** Refreshes `s.melted`: each letter's mean column progress. */
export function updateMelted(s: SimState): void {
  'worklet';
  for (let i = 0; i < LETTERS; i++) {
    let sum = 0;
    for (let c = 0; c < MELT_COLS; c++) {
      sum += progressAt(s, i * MELT_COLS + c);
    }
    s.melted[i] = sum / MELT_COLS;
  }
}

/** Letter-local (ax, ay) to where it sits mid-melt, in canvas points. */
export function meltPoint(
  s: SimState,
  i: number,
  ax: number,
  ay: number,
  out: Float32Array,
): void {
  'worklet';
  const w = s.word;
  const h = w.h[i]!;
  const p = columnProgress(s, i, ax);
  const bottom = w.cy[i]! + h / 2;
  // The column slides down to the floor while its height shrinks to a puddle.
  const base = bottom + (w.floorY - bottom) * p;
  const depth = PUDDLE_DEPTH * columnDepth(s, i, ax);
  const height = Math.max(h * Math.pow(1 - p, 1.2), h * depth * p);
  // Height fraction above the base; the top compresses fastest, so mass settles low.
  const frac = (h / 2 - ay) / h;
  const f = frac <= 0 ? frac : Math.pow(frac, 1 + 1.2 * p);
  const low = 1 - Math.max(0, Math.min(1, f));
  out[0] = w.cx[i]! + ax * (1 + BASE_SPREAD * p * low * low);
  out[1] = base - f * height;
}

/** Writes letter i's grid positions: melting in melt mode, rigid otherwise. */
export function writeMesh(
  s: SimState,
  i: number,
  positions: Float32Array,
): void {
  'worklet';
  const t = s.word.tube;
  const tx = t[i * 4]!;
  const ty = t[i * 4 + 1]!;
  const tw = t[i * 4 + 2]!;
  const th = t[i * 4 + 3]!;
  const melt = s.mode === MODE_MELT;
  for (let r = 0; r < MESH_ROWS; r++) {
    const ay = ty + (r / (MESH_ROWS - 1)) * th;
    for (let c = 0; c < MESH_COLS; c++) {
      const ax = tx + (c / (MESH_COLS - 1)) * tw;
      if (melt) {
        meltPoint(s, i, ax, ay, s.tmp);
      } else {
        letterPoint(s, i, ax, ay, s.tmp);
      }
      const o = (r * MESH_COLS + c) * 2;
      positions[o] = s.tmp[0]!;
      positions[o + 1] = s.tmp[1]!;
    }
  }
}

/** Two triangles per grid cell. Set once; the grid's topology never changes. */
export function gridIndices(): number[] {
  const out: number[] = [];
  for (let r = 0; r < MESH_ROWS - 1; r++) {
    for (let c = 0; c < MESH_COLS - 1; c++) {
      const a = r * MESH_COLS + c;
      const b = a + 1;
      const d = a + MESH_COLS;
      const e = d + 1;
      out.push(a, b, d, b, e, d);
    }
  }
  return out;
}

/** Texture coordinates in image pixels: the grid spans the whole height image. */
export function gridTextures(
  imageWidth: number,
  imageHeight: number,
): number[] {
  const out: number[] = [];
  for (let r = 0; r < MESH_ROWS; r++) {
    for (let c = 0; c < MESH_COLS; c++) {
      out.push(
        (c / (MESH_COLS - 1)) * imageWidth,
        (r / (MESH_ROWS - 1)) * imageHeight,
      );
    }
  }
  return out;
}
