// apps/example/src/__tests__/typeMelt/state.test.ts
import {
  CHAIN,
  MAX_ANCHORS,
  MODE_EXPLODE,
  MODE_FALL,
  MODE_MELT,
  PHASE_INTACT,
  PHASE_REBUILDING,
  createState,
  distToSegment,
  finishRebuild,
  letterPoint,
  nextRand,
} from '../../typeMelt/state';
import { springLetters, springSprites, wrapAngle } from '../../typeMelt/springHome';
import { fakeWord } from '../../__fixtures__/typeMelt/fakeWord';

test('createState puts every letter at home, upright and unsagged', () => {
  const s = createState(fakeWord(), MODE_EXPLODE);
  expect(Array.from(s.lx)).toEqual([80, 160, 240, 320]);
  expect(Array.from(s.ly)).toEqual([200, 200, 200, 200]);
  expect(Array.from(s.la)).toEqual([0, 0, 0, 0]);
  expect(Array.from(s.lsy)).toEqual([1, 1, 1, 1]);
  expect(s.phase).toBe(PHASE_INTACT);
  expect(s.n).toBe(0);
  expect(s.letterOpacity).toBe(1);
});

test('melt mode starts with every chain collapsed onto its anchor', () => {
  const s = createState(fakeWord(), MODE_MELT);
  expect(s.n).toBe(MAX_ANCHORS * CHAIN);
  const out = new Float32Array(2);
  letterPoint(s, 0, s.word.anchors[0]!, s.word.anchors[1]!, out);
  for (let j = 0; j < CHAIN; j++) {
    expect(s.px[j]).toBeCloseTo(out[0]!);
    expect(s.py[j]).toBeCloseTo(out[1]!);
  }
});

test('letterPoint applies scaleY, then rotation, then translation', () => {
  const s = createState(fakeWord(), MODE_FALL);
  const out = new Float32Array(2);
  s.lsy[1] = 0.5;
  s.la[1] = Math.PI / 2;
  letterPoint(s, 1, 10, 20, out);
  // (10, 20) → scaleY (10, 10) → rotate 90° (-10, 10) → + (160, 200)
  expect(out[0]).toBeCloseTo(150);
  expect(out[1]).toBeCloseTo(210);
});

test('distToSegment measures to the segment, and a zero-length swipe is a point', () => {
  const imp = { sx: 0, sy: 0, ex: 10, ey: 0, speed: 0 };
  expect(distToSegment(5, 3, imp)).toBeCloseTo(3);
  expect(distToSegment(-4, 3, imp)).toBeCloseTo(5);
  expect(distToSegment(3, 4, { sx: 0, sy: 0, ex: 0, ey: 0, speed: 0 })).toBeCloseTo(5);
});

test('nextRand is seeded by the word', () => {
  const a = createState(fakeWord(), MODE_MELT);
  const b = createState(fakeWord(), MODE_MELT);
  expect([nextRand(a), nextRand(a)]).toEqual([nextRand(b), nextRand(b)]);
});

test('finishRebuild enters the pending mode intact', () => {
  const s = createState(fakeWord(), MODE_MELT);
  s.phase = PHASE_REBUILDING;
  s.pendingMode = MODE_EXPLODE;
  finishRebuild(s);
  expect(s.mode).toBe(MODE_EXPLODE);
  expect(s.phase).toBe(PHASE_INTACT);
  expect(s.n).toBe(0);
});

test('wrapAngle keeps the shortest way home', () => {
  // ±π are equally short; only the magnitude is defined there.
  expect(Math.abs(wrapAngle(3 * Math.PI))).toBeCloseTo(Math.PI);
  expect(wrapAngle(2.5 * Math.PI)).toBeCloseTo(0.5 * Math.PI);
  expect(wrapAngle(-0.5 * Math.PI + 4 * Math.PI)).toBeCloseTo(-0.5 * Math.PI);
});

test('springLetters converges from a scattered pile within 1.5 s', () => {
  const s = createState(fakeWord(), MODE_FALL);
  for (let i = 0; i < 4; i++) {
    s.lx[i] = 20 + i * 5;
    s.ly[i] = 280;
    s.la[i] = 5 * Math.PI + i;
    s.lvx[i] = 300;
  }
  let err = Infinity;
  for (let k = 0; k < 90; k++) {
    err = springLetters(s, 1 / 60);
  }
  expect(err).toBeLessThan(0.5);
});

test('springSprites converges sprites to their homes', () => {
  const s = createState(fakeWord(), MODE_EXPLODE);
  s.n = s.word.homeCount;
  for (let i = 0; i < s.n; i++) {
    s.px[i] = 0;
    s.py[i] = 300;
    s.vx[i] = -500;
  }
  let err = Infinity;
  for (let k = 0; k < 90; k++) {
    err = springSprites(s, 1 / 60, s.n);
  }
  expect(err).toBeLessThan(0.5);
});
