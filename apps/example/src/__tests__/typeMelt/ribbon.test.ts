import {
  RIBBON_ACROSS,
  RIBBON_INDICES,
  RIBBON_VERTS,
  ribbonColors,
  ribbonIndices,
  writeRibbon,
} from '../../typeMelt/ribbon';
import {
  CHAIN,
  MAX_ANCHORS,
  MODE_EXPLODE,
  createState,
} from '../../typeMelt/state';
import { fakeWord } from '../../__fixtures__/typeMelt/fakeWord';

test('ribbon indices are in range and cover every strand segment', () => {
  const idx = ribbonIndices();
  expect(idx.length).toBe(RIBBON_INDICES);
  expect(RIBBON_INDICES).toBe(
    MAX_ANCHORS * (CHAIN - 1) * (RIBBON_ACROSS - 1) * 6,
  );
  for (const v of idx) {
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(RIBBON_VERTS);
  }
});

test('ribbon colours are white, opaque at the centre and clear at the edges', () => {
  const c = ribbonColors();
  expect(c.length).toBe(RIBBON_VERTS * 4);
  const alpha = (k: number) => c[k * 4 + 3]!;
  expect(alpha(0)).toBe(0);
  expect(alpha((RIBBON_ACROSS - 1) / 2)).toBe(1);
  expect(alpha(RIBBON_ACROSS - 1)).toBe(0);
  expect([c[0], c[1], c[2]]).toEqual([1, 1, 1]);
});

test('a hanging strand gets a ribbon as wide as its nodes, across its direction', () => {
  const s = createState(fakeWord(), MODE_EXPLODE);
  s.mode = 0; // melt
  // Anchor 0 hangs straight down from (100, 100), nodes 5 apart, radius 4.
  for (let j = 0; j < CHAIN; j++) {
    s.px[j] = 100;
    s.py[j] = 100 + j * 5;
    s.r[j] = 4;
  }
  const pos = new Float32Array(RIBBON_VERTS * 2);
  writeRibbon(s, pos);
  // Node 3: its five vertices run left to right across the strand at y = 115.
  const at = (j: number, k: number) => {
    const o = (j * RIBBON_ACROSS + k) * 2;
    return [pos[o]!, pos[o + 1]!];
  };
  expect(at(3, 0)[0]).toBeCloseTo(96);
  expect(at(3, RIBBON_ACROSS - 1)[0]).toBeCloseTo(104);
  expect(at(3, (RIBBON_ACROSS - 1) / 2)).toEqual([100, 115]);
  for (let k = 0; k < RIBBON_ACROSS; k++) expect(at(3, k)[1]).toBeCloseTo(115);
});

test('outside melt mode every ribbon collapses to nothing', () => {
  const s = createState(fakeWord(), MODE_EXPLODE);
  s.px[0] = 50;
  s.r[0] = 9;
  const pos = new Float32Array(RIBBON_VERTS * 2).fill(7);
  writeRibbon(s, pos);
  expect(pos.every(v => v === 0)).toBe(true);
});
