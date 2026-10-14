// A letter's height field: how far each pixel sits from the letter's edge,
// bent into a circular profile, so every stroke reads as a round tube rather
// than a flat face with rounded shoulders. Runs once per letter per canvas size.

const INF = 1e20;

/** Felzenszwalb's 1D squared distance transform of `f` (length n) into `d`. */
function edt1d(
  f: Float64Array,
  n: number,
  d: Float64Array,
  v: Int32Array,
  z: Float64Array,
): void {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    while (s <= z[k]!) {
      k--;
      s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) {
      k++;
    }
    d[q] = (q - v[k]!) * (q - v[k]!) + f[v[k]!]!;
  }
}

/**
 * Euclidean distance from each pixel inside the mask (alpha ≥ `cut` in RGBA
 * bytes) to the nearest pixel outside it; 0 outside.
 */
export function distanceInside(
  rgba: Uint8Array,
  w: number,
  h: number,
  cut = 128,
): Float32Array {
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  const grid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    grid[i] = rgba[i * 4 + 3]! >= cut ? INF : 0;
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x]!;
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y]!;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x]!;
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x]!;
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    out[i] = Math.sqrt(grid[i]!);
  }
  return out;
}

/**
 * Premultiplied white RGBA whose alpha is the tube height: a quarter circle
 * from the edge to `radiusPx` deep, flat beyond. The liquid shader reads the
 * composited alpha as height, so overlapping tubes and droplets fuse.
 */
export function tubeHeights(
  rgba: Uint8Array,
  w: number,
  h: number,
  radiusPx: number,
): Uint8Array {
  const dist = distanceInside(rgba, w, h);
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const u = Math.min(dist[i]! / radiusPx, 1);
    const a = Math.round(255 * Math.sqrt(1 - (1 - u) * (1 - u)));
    out[i * 4] = a;
    out[i * 4 + 1] = a;
    out[i * 4 + 2] = a;
    out[i * 4 + 3] = a;
  }
  return out;
}
