// apps/example/src/__tests__/typeMelt/sampling.test.ts
import {
  bottomAnchors,
  mulberry32,
  pickSpread,
  sampleInside,
  type Box,
} from '../../typeMelt/sampling';

const box: Box = { x: -30, y: -50, width: 60, height: 100 };
const rect = (x: number, y: number) => Math.abs(x) <= 30 && Math.abs(y) <= 50;
// An upside-down T: a stem plus a wide foot, so columns find different bottoms.
const tee = (x: number, y: number) =>
  (Math.abs(x) <= 8 && y >= -50 && y <= 50) || (y >= -50 && y <= -35 && Math.abs(x) <= 30);

test('mulberry32 is deterministic and in [0, 1)', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 100; i++) {
    const v = a();
    expect(v).toBe(b());
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  }
});

test('sampleInside keeps only inside points, roughly one per spacing cell', () => {
  const pts = sampleInside(rect, box, 6, mulberry32(1));
  expect(pts.length % 2).toBe(0);
  const n = pts.length / 2;
  expect(n).toBeGreaterThan(130); // 10 × 16 cells, a few lost to jitter at the edge
  expect(n).toBeLessThanOrEqual(10 * 17);
  for (let i = 0; i < pts.length; i += 2) {
    expect(rect(pts[i]!, pts[i + 1]!)).toBe(true);
  }
});

test('sampleInside points never sit closer than half a spacing', () => {
  const pts = sampleInside(rect, box, 6, mulberry32(3));
  let min = Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    for (let j = i + 2; j < pts.length; j += 2) {
      min = Math.min(min, Math.hypot(pts[i]! - pts[j]!, pts[i + 1]! - pts[j + 1]!));
    }
  }
  expect(min).toBeGreaterThanOrEqual(3 - 1e-6);
});

test('bottomAnchors finds the lowest inside point per column', () => {
  const a = bottomAnchors(tee, box, 4, 1);
  // Columns at x = -22.5, -7.5, 7.5, 22.5: the outer two only hit the foot's
  // underside (y ≈ -35); the inner two hit the stem bottom (y ≈ 50).
  expect(a).toHaveLength(8);
  expect(a[1]!).toBeLessThan(-34);
  expect(a[3]!).toBeGreaterThan(48);
  expect(a[5]!).toBeGreaterThan(48);
  expect(a[7]!).toBeLessThan(-34);
  for (let i = 0; i < a.length; i += 2) {
    expect(tee(a[i]!, a[i + 1]!)).toBe(true);
  }
});

test('bottomAnchors skips columns with no ink', () => {
  const thin = (x: number, y: number) => Math.abs(x) <= 2 && Math.abs(y) <= 50;
  expect(bottomAnchors(thin, box, 4, 1)).toHaveLength(0);
  expect(bottomAnchors(thin, box, 1, 1)).toHaveLength(2);
});

test('pickSpread returns k far-apart points from the input', () => {
  const pts = sampleInside(rect, box, 6, mulberry32(1));
  const k = pickSpread(pts, 6);
  expect(k).toHaveLength(12);
  let min = Infinity;
  for (let i = 0; i < k.length; i += 2) {
    for (let j = i + 2; j < k.length; j += 2) {
      min = Math.min(min, Math.hypot(k[i]! - k[j]!, k[i + 1]! - k[j + 1]!));
    }
  }
  expect(min).toBeGreaterThan(25);
});

test('pickSpread pads short input and handles empty input', () => {
  expect(pickSpread([1, 2], 3)).toEqual([1, 2, 1, 2, 1, 2]);
  expect(pickSpread([], 3)).toEqual([]);
});
