// apps/example/src/typeMelt/state.ts
// TypeMelt's simulation state: typed arrays only, created once on the UI
// runtime and mutated in place by the per-mode steps — nothing allocates per frame.

export const CAP = 2048;
export const LETTERS = 4;
export const CHAIN = 8;
export const ANCHORS_PER_LETTER = 4;
export const MAX_ANCHORS = LETTERS * ANCHORS_PER_LETTER;
export const CIRCLES_PER_LETTER = 6;
/** The blob sprite's texture size, in image pixels (rendered at pixelRatio 1). */
export const BLOB = 64;
export const MAX_DT = 1 / 30;
export const GRAVITY = 1800;
export const BOUNCE = 0.3;

export const MODE_MELT = 0;
export const MODE_EXPLODE = 1;
export const MODE_FALL = 2;

export const PHASE_INTACT = 0;
export const PHASE_DESTROYED = 1;
export const PHASE_REBUILDING = 2;

/** Everything the sims read about the word: numbers and typed arrays only, so a worklet can capture it. */
export interface WordData {
  width: number;
  height: number;
  floorY: number;
  fontSize: number;
  /** Per letter: home centre and tight box size, canvas points. */
  cx: Float32Array;
  cy: Float32Array;
  w: Float32Array;
  h: Float32Array;
  /** Droplet homes in canvas points, x/y pairs. */
  homes: Float32Array;
  homeCount: number;
  /** Drip anchors in letter-local points, x/y pairs, ANCHORS_PER_LETTER per letter; NaN marks an unused slot. */
  anchors: Float32Array;
  /** Collision circle centres in letter-local points, x/y pairs, CIRCLES_PER_LETTER per letter. */
  circles: Float32Array;
  circleR: Float32Array;
  /** Droplet radius, points. */
  dropR: number;
  seed: number;
}

/** A swipe: where it started and ended, and how fast it was going when it ended (points/s). */
export interface Impulse {
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  speed: number;
}

export interface SimState {
  word: WordData;
  mode: number;
  pendingMode: number;
  phase: number;
  /** Live sprites, drawn from index 0. */
  n: number;
  t: number;
  letterOpacity: number;
  rand: number;
  // Sprites. ox/oy are melt's Verlet previous positions.
  px: Float32Array;
  py: Float32Array;
  ox: Float32Array;
  oy: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  r: Float32Array;
  // Letters: position, angle, vertical scale, and their velocities.
  lx: Float32Array;
  ly: Float32Array;
  la: Float32Array;
  lsy: Float32Array;
  lvx: Float32Array;
  lvy: Float32Array;
  lva: Float32Array;
  lvsy: Float32Array;
  // Melt, per anchor.
  stretch: Float32Array;
  rate: Float32Array;
  boost: Float32Array;
  // Scratch, so the steps never allocate.
  cwx: Float32Array;
  cwy: Float32Array;
  tmp: Float32Array;
  tmpA: Float32Array;
  tmpB: Float32Array;
}

export function nextRand(s: SimState): number {
  'worklet';
  s.rand = (s.rand + 0x6d2b79f5) | 0;
  let t = Math.imul(s.rand ^ (s.rand >>> 15), s.rand | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Letter-local (ax, ay) to canvas points: scaleY, then rotate, then translate — the group's transform order. */
export function letterPoint(
  s: SimState,
  i: number,
  ax: number,
  ay: number,
  out: Float32Array,
): void {
  'worklet';
  const y = ay * s.lsy[i]!;
  const c = Math.cos(s.la[i]!);
  const n = Math.sin(s.la[i]!);
  out[0] = s.lx[i]! + ax * c - y * n;
  out[1] = s.ly[i]! + ax * n + y * c;
}

export function distToSegment(x: number, y: number, imp: Impulse): number {
  'worklet';
  const dx = imp.ex - imp.sx;
  const dy = imp.ey - imp.sy;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 1e-9 ? Math.max(0, Math.min(1, ((x - imp.sx) * dx + (y - imp.sy) * dy) / len2)) : 0;
  return Math.hypot(x - (imp.sx + dx * t), y - (imp.sy + dy * t));
}

/** Keeps sprite i above the floor and between the walls, bouncing off them. */
export function collideBounds(s: SimState, i: number): void {
  'worklet';
  const r = s.r[i]!;
  const w = s.word;
  if (s.py[i]! > w.floorY - r) {
    s.py[i] = w.floorY - r;
    if (s.vy[i]! > 0) {
      s.vy[i] = -s.vy[i]! * BOUNCE;
    }
    s.vx[i] = s.vx[i]! * 0.8;
  }
  if (s.px[i]! < r) {
    s.px[i] = r;
    if (s.vx[i]! < 0) {
      s.vx[i] = -s.vx[i]! * BOUNCE;
    }
  } else if (s.px[i]! > w.width - r) {
    s.px[i] = w.width - r;
    if (s.vx[i]! > 0) {
      s.vx[i] = -s.vx[i]! * BOUNCE;
    }
  }
}

/** Radius of drip node j: wide where it meets the letter, a thin neck, a fat bulb at the head. */
export function nodeRadius(R: number, j: number): number {
  'worklet';
  if (j === 0) {
    return R;
  }
  if (j === CHAIN - 1) {
    return R * 0.95;
  }
  return R * (0.45 + 0.3 * (1 - j / (CHAIN - 1)));
}

/** Puts the current mode in its intact pose: letters home, sprites as that mode wants them at rest. */
export function resetMode(s: SimState): void {
  'worklet';
  const w = s.word;
  for (let i = 0; i < LETTERS; i++) {
    s.lx[i] = w.cx[i]!;
    s.ly[i] = w.cy[i]!;
    s.la[i] = 0;
    s.lsy[i] = 1;
    s.lvx[i] = 0;
    s.lvy[i] = 0;
    s.lva[i] = 0;
    s.lvsy[i] = 0;
  }
  s.letterOpacity = 1;
  if (s.mode !== MODE_MELT) {
    s.n = 0;
    return;
  }
  s.n = MAX_ANCHORS * CHAIN;
  const R = w.dropR * 1.6;
  for (let a = 0; a < MAX_ANCHORS; a++) {
    s.stretch[a] = 0;
    s.boost[a] = 0;
    const ax = w.anchors[a * 2]!;
    const unused = ax !== ax;
    if (!unused) {
      letterPoint(s, (a / ANCHORS_PER_LETTER) | 0, ax, w.anchors[a * 2 + 1]!, s.tmp);
    }
    for (let j = 0; j < CHAIN; j++) {
      const k = a * CHAIN + j;
      s.px[k] = s.ox[k] = unused ? 0 : s.tmp[0]!;
      s.py[k] = s.oy[k] = unused ? 0 : s.tmp[1]!;
      s.vx[k] = 0;
      s.vy[k] = 0;
      s.r[k] = unused ? 0 : nodeRadius(R, j);
    }
  }
}

export function finishRebuild(s: SimState): void {
  'worklet';
  s.phase = PHASE_INTACT;
  s.mode = s.pendingMode;
  resetMode(s);
}

export function createState(word: WordData, mode: number): SimState {
  'worklet';
  const s: SimState = {
    word,
    mode,
    pendingMode: mode,
    phase: PHASE_INTACT,
    n: 0,
    t: 0,
    letterOpacity: 1,
    rand: word.seed | 0,
    px: new Float32Array(CAP),
    py: new Float32Array(CAP),
    ox: new Float32Array(CAP),
    oy: new Float32Array(CAP),
    vx: new Float32Array(CAP),
    vy: new Float32Array(CAP),
    r: new Float32Array(CAP),
    lx: new Float32Array(LETTERS),
    ly: new Float32Array(LETTERS),
    la: new Float32Array(LETTERS),
    lsy: new Float32Array(LETTERS),
    lvx: new Float32Array(LETTERS),
    lvy: new Float32Array(LETTERS),
    lva: new Float32Array(LETTERS),
    lvsy: new Float32Array(LETTERS),
    stretch: new Float32Array(MAX_ANCHORS),
    rate: new Float32Array(MAX_ANCHORS),
    boost: new Float32Array(MAX_ANCHORS),
    cwx: new Float32Array(LETTERS * CIRCLES_PER_LETTER),
    cwy: new Float32Array(LETTERS * CIRCLES_PER_LETTER),
    tmp: new Float32Array(2),
    tmpA: new Float32Array(2),
    tmpB: new Float32Array(2),
  };
  for (let a = 0; a < MAX_ANCHORS; a++) {
    s.rate[a] = 6 + 12 * nextRand(s);
  }
  resetMode(s);
  return s;
}
