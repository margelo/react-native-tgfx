// apps/example/src/typeMelt/sampling.ts
// Geometry sampling for TypeMelt, kept free of native calls so Jest can run it:
// the caller hands in `contains` (pathContains on device, a predicate in tests).

export type Contains = (x: number, y: number) => boolean;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A jittered grid over `box`, keeping what `contains` accepts. Jitter stays
 * within a quarter cell, so no two points are closer than half a spacing.
 */
export function sampleInside(
  contains: Contains,
  box: Box,
  spacing: number,
  rand: () => number,
): number[] {
  const out: number[] = [];
  for (let y = box.y + spacing / 2; y < box.y + box.height; y += spacing) {
    for (let x = box.x + spacing / 2; x < box.x + box.width; x += spacing) {
      const jx = x + (rand() - 0.5) * spacing * 0.5;
      const jy = y + (rand() - 0.5) * spacing * 0.5;
      if (contains(jx, jy)) {
        out.push(jx, jy);
      }
    }
  }
  return out;
}

/**
 * Splits the box into `count` columns and, for each, scans up from the box's
 * bottom edge for the first inside point — where a drip hangs from.
 */
export function bottomAnchors(
  contains: Contains,
  box: Box,
  count: number,
  step: number,
): number[] {
  const out: number[] = [];
  for (let c = 0; c < count; c++) {
    const x = box.x + ((c + 0.5) * box.width) / count;
    for (let y = box.y + box.height; y >= box.y; y -= step) {
      if (contains(x, y)) {
        out.push(x, y);
        break;
      }
    }
  }
  return out;
}

/** Farthest-point sampling: `k` points spread across the input, as x/y pairs. */
export function pickSpread(points: number[], k: number): number[] {
  const n = points.length / 2;
  if (n === 0) {
    return [];
  }
  const out: number[] = [points[0]!, points[1]!];
  const nearest = new Float64Array(n).fill(Infinity);
  while (out.length < k * 2) {
    const lx = out[out.length - 2]!;
    const ly = out[out.length - 1]!;
    let best = -1;
    let bestD = 0;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(points[i * 2]! - lx, points[i * 2 + 1]! - ly);
      nearest[i] = Math.min(nearest[i]!, d);
      if (nearest[i]! > bestD) {
        bestD = nearest[i]!;
        best = i;
      }
    }
    if (best < 0) {
      out.push(points[0]!, points[1]!);
    } else {
      out.push(points[best * 2]!, points[best * 2 + 1]!);
    }
  }
  return out;
}
