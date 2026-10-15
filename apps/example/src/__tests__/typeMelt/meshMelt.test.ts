import {
  MESH_COLS,
  MESH_ROWS,
  MESH_VERTS,
  columnProgress,
  gridIndices,
  gridTextures,
  meltPoint,
  writeMesh,
} from '../../typeMelt/meshMelt';
import {
  MODE_FALL,
  MODE_MELT,
  createState,
  type SimState,
} from '../../typeMelt/state';
import { fakeWord } from '../../__fixtures__/typeMelt/fakeWord';

const out = new Float32Array(2);
const at = (s: SimState, i: number, ax: number, ay: number) => {
  meltPoint(s, i, ax, ay, out);
  return [out[0]!, out[1]!];
};

test('an unmelted letter maps every point to its resting place', () => {
  const s = createState(fakeWord(), MODE_MELT);
  expect(at(s, 1, 0, 0)).toEqual([160, 200]);
  const [x, y] = at(s, 2, -20, 40);
  expect(x).toBeCloseTo(220);
  expect(y).toBeCloseTo(240);
});

test('tops melt before bottoms', () => {
  const s = createState(fakeWord(), MODE_MELT);
  s.meltT = 8;
  const top = at(s, 0, 0, -50)[1]! - 150;
  const bottom = at(s, 0, 0, 50)[1]! - 250;
  expect(top).toBeGreaterThan(bottom * 1.5 + 5);
});

test('columns melt on their own schedules, so the top edge goes uneven', () => {
  const s = createState(fakeWord(), MODE_MELT);
  s.meltT = 7;
  let lo = Infinity;
  let hi = -Infinity;
  for (let ax = -28; ax <= 28; ax += 4) {
    const y = at(s, 0, ax, -50)[1]!;
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  expect(hi - lo).toBeGreaterThan(4);
  // Progress itself varies across the letter.
  expect(columnProgress(s, 0, -28)).not.toBeCloseTo(
    columnProgress(s, 0, 28),
    2,
  );
});

test('a fully melted letter lies in a puddle on the floor, wider than it stood', () => {
  const s = createState(fakeWord(), MODE_MELT);
  s.meltT = 60;
  let left = Infinity;
  let right = -Infinity;
  for (let ax = -30; ax <= 30; ax += 5) {
    for (let ay = -50; ay <= 50; ay += 10) {
      const [x, y] = at(s, 3, ax, ay);
      expect(y).toBeLessThanOrEqual(300 + 1e-3);
      expect(y).toBeGreaterThanOrEqual(300 - 0.13 * 1.5 * 100 - 1e-3);
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  expect(right - left).toBeGreaterThan(60 * 1.5);
  expect(s.melted.length).toBe(4);
});

test('the base spreads wider than the top', () => {
  const s = createState(fakeWord(), MODE_MELT);
  s.meltT = 9;
  const width = (ay: number) => at(s, 1, 30, ay)[0]! - at(s, 1, -30, ay)[0]!;
  expect(width(50)).toBeGreaterThan(width(-50) + 2);
});

test('writeMesh lays the grid rigidly over a falling letter', () => {
  const s = createState(fakeWord(), MODE_FALL);
  s.lx[0] = 100;
  s.ly[0] = 120;
  s.la[0] = Math.PI / 2;
  const positions = new Float32Array(MESH_VERTS * 2);
  writeMesh(s, 0, positions);
  // First vertex is the tube rect's top-left corner (-35, -55) rotated 90°.
  expect(positions[0]).toBeCloseTo(100 + 55);
  expect(positions[1]).toBeCloseTo(120 - 35);
});

test('writeMesh follows the melt in melt mode', () => {
  const s = createState(fakeWord(), MODE_MELT);
  const rest = new Float32Array(MESH_VERTS * 2);
  writeMesh(s, 0, rest);
  s.meltT = 8;
  const melting = new Float32Array(MESH_VERTS * 2);
  writeMesh(s, 0, melting);
  // The top-centre vertex has sunk.
  const top = Math.floor(MESH_COLS / 2) * 2 + 1;
  expect(melting[top]!).toBeGreaterThan(rest[top]! + 5);
});

test('grid indices cover the mesh with in-range triangles', () => {
  const idx = gridIndices();
  expect(idx.length).toBe((MESH_COLS - 1) * (MESH_ROWS - 1) * 6);
  for (const v of idx) {
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(MESH_VERTS);
  }
});

test('grid textures span the whole image, in image pixels', () => {
  const uv = gridTextures(200, 300);
  expect([uv[0], uv[1]]).toEqual([0, 0]);
  const last = (MESH_VERTS - 1) * 2;
  expect([uv[last], uv[last + 1]]).toEqual([200, 300]);
});

test('the puddle is uneven: its depth varies from column to column', () => {
  const s = createState(fakeWord(), MODE_MELT);
  s.meltT = 60;
  let lo = Infinity;
  let hi = -Infinity;
  for (let ax = -30; ax <= 30; ax += 3) {
    const top = at(s, 2, ax, -50)[1]!;
    lo = Math.min(lo, top);
    hi = Math.max(hi, top);
  }
  expect(hi - lo).toBeGreaterThan(3);
});
