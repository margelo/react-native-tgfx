// apps/example/src/__tests__/typeMelt/fakeWord.ts
import {
  bottomAnchors,
  mulberry32,
  pickSpread,
  sampleInside,
} from '../../typeMelt/sampling';
import {
  ANCHORS_PER_LETTER,
  CIRCLES_PER_LETTER,
  LETTERS,
  type WordData,
} from '../../typeMelt/state';

/** Four 60×100 rectangles standing in for TGFX, 50 px above a floor at y = 300. */
export function fakeWord(): WordData {
  const cx = new Float32Array([80, 160, 240, 320]);
  const cy = new Float32Array(LETTERS).fill(200);
  const w = new Float32Array(LETTERS).fill(60);
  const h = new Float32Array(LETTERS).fill(100);
  const rand = mulberry32(1);
  const box = { x: -30, y: -50, width: 60, height: 100 };
  const contains = (x: number, y: number) => Math.abs(x) <= 30 && Math.abs(y) <= 50;
  const homes: number[] = [];
  const anchors = new Float32Array(LETTERS * ANCHORS_PER_LETTER * 2).fill(NaN);
  const circles = new Float32Array(LETTERS * CIRCLES_PER_LETTER * 2);
  for (let i = 0; i < LETTERS; i++) {
    const pts = sampleInside(contains, box, 6, rand);
    for (let k = 0; k < pts.length; k += 2) {
      homes.push(cx[i]! + pts[k]!, cy[i]! + pts[k + 1]!);
    }
    anchors.set(bottomAnchors(contains, box, ANCHORS_PER_LETTER, 1), i * ANCHORS_PER_LETTER * 2);
    circles.set(pickSpread(pts, CIRCLES_PER_LETTER), i * CIRCLES_PER_LETTER * 2);
  }
  return {
    width: 400,
    height: 400,
    floorY: 300,
    fontSize: 120,
    cx,
    cy,
    w,
    h,
    homes: Float32Array.from(homes),
    homeCount: homes.length / 2,
    anchors,
    circles,
    circleR: new Float32Array(LETTERS).fill(15),
    dropR: 4.5,
    seed: 1,
  };
}
