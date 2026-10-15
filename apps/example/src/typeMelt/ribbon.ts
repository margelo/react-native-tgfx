// Drip strands as one ribbon mesh. Each strand was CHAIN overlapping sprites,
// and the renderer's cost is per sprite: a few hundred of them held the melt
// under 60 fps. A ribbon is RIBBON_ACROSS vertices across each chain node,
// alpha rising to 1 at the centre so the height field reads it as a tube.
import { CHAIN, MAX_ANCHORS, MODE_MELT, type SimState } from './state';

export const RIBBON_ACROSS = 5;
export const RIBBON_VERTS = MAX_ANCHORS * CHAIN * RIBBON_ACROSS;
export const RIBBON_INDICES =
  MAX_ANCHORS * (CHAIN - 1) * (RIBBON_ACROSS - 1) * 6;
/** Across-strand offsets, × the node radius, and the alpha (height) at each. */
const OFFSETS = [-1, -0.6, 0, 0.6, 1];
const ALPHAS = [0, 0.8, 1, 0.8, 0];

/** Two triangles per cell between neighbouring nodes. Set once. */
export function ribbonIndices(): number[] {
  const out: number[] = [];
  for (let a = 0; a < MAX_ANCHORS; a++) {
    for (let j = 0; j < CHAIN - 1; j++) {
      const row = (a * CHAIN + j) * RIBBON_ACROSS;
      const next = row + RIBBON_ACROSS;
      for (let k = 0; k < RIBBON_ACROSS - 1; k++) {
        out.push(
          row + k,
          row + k + 1,
          next + k,
          row + k + 1,
          next + k + 1,
          next + k,
        );
      }
    }
  }
  return out;
}

/** White, with the tube profile in alpha. Set once. */
export function ribbonColors(): number[] {
  const out: number[] = [];
  for (let v = 0; v < MAX_ANCHORS * CHAIN; v++) {
    for (let k = 0; k < RIBBON_ACROSS; k++) {
      out.push(1, 1, 1, ALPHAS[k]!);
    }
  }
  return out;
}

/**
 * Lays each strand's ribbon along its chain nodes, as wide as each node's
 * radius. Outside melt mode the sprite slots hold droplets, not chains, so
 * every ribbon collapses to nothing.
 */
export function writeRibbon(s: SimState, positions: Float32Array): void {
  'worklet';
  if (s.mode !== MODE_MELT) {
    positions.fill(0);
    return;
  }
  for (let a = 0; a < MAX_ANCHORS; a++) {
    const base = a * CHAIN;
    for (let j = 0; j < CHAIN; j++) {
      const k = base + j;
      // Direction along the strand, from the neighbours on either side.
      const p = j > 0 ? k - 1 : k;
      const q = j < CHAIN - 1 ? k + 1 : k;
      let dx = s.px[q]! - s.px[p]!;
      let dy = s.py[q]! - s.py[p]!;
      const len = Math.hypot(dx, dy);
      if (len > 1e-6) {
        dx /= len;
        dy /= len;
      } else {
        dx = 0;
        dy = 1;
      }
      // Across the strand, left to right when it hangs down.
      const nx = -dy;
      const ny = dx;
      const r = s.r[k]!;
      const o = k * RIBBON_ACROSS * 2;
      for (let c = 0; c < RIBBON_ACROSS; c++) {
        positions[o + c * 2] = s.px[k]! - nx * r * OFFSETS[c]!;
        positions[o + c * 2 + 1] = s.py[k]! - ny * r * OFFSETS[c]!;
      }
    }
  }
}
