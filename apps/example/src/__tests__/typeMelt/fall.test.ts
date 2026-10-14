// apps/example/src/__tests__/typeMelt/fall.test.ts
import { destroyFall, stepFall } from '../../typeMelt/fall';
import {
  CIRCLES_PER_LETTER,
  MODE_FALL,
  PHASE_DESTROYED,
  PHASE_INTACT,
  PHASE_REBUILDING,
  createState,
  letterPoint,
  type SimState,
} from '../../typeMelt/state';
import { fakeWord } from '../../__fixtures__/typeMelt/fakeWord';

// Crosses letters 1 and 2 only: letters 0 and 3 sit 75 pt from it, past the 70 pt reach.
const swipe = { sx: 155, sy: 200, ex: 245, ey: 192, speed: 2500 };

function run(s: SimState, steps: number) {
  for (let k = 0; k < steps; k++) {
    stepFall(s, 1 / 60);
  }
}

function circlesInBounds(s: SimState, slack: number) {
  const out = new Float32Array(2);
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < CIRCLES_PER_LETTER; k++) {
      const c = (i * CIRCLES_PER_LETTER + k) * 2;
      letterPoint(s, i, s.word.circles[c]!, s.word.circles[c + 1]!, out);
      const r = s.word.circleR[i]!;
      expect(Number.isFinite(out[0]!)).toBe(true);
      expect(out[1]! + r).toBeLessThanOrEqual(s.word.floorY + slack);
      expect(out[0]! - r).toBeGreaterThanOrEqual(-slack);
      expect(out[0]! + r).toBeLessThanOrEqual(s.word.width + slack);
    }
  }
}

test('intact letters do not move', () => {
  const s = createState(fakeWord(), MODE_FALL);
  run(s, 60);
  expect(Array.from(s.ly)).toEqual([200, 200, 200, 200]);
});

test('the swipe hits only the letters it crosses', () => {
  const s = createState(fakeWord(), MODE_FALL);
  destroyFall(s, swipe);
  expect(s.phase).toBe(PHASE_DESTROYED);
  expect(Math.abs(s.lvx[0]!)).toBe(0);
  expect(s.lvx[1]!).toBeGreaterThan(100);
  expect(s.lvx[2]!).toBeGreaterThan(100);
  expect(Math.abs(s.lvx[3]!)).toBe(0);
});

test('letters fall, pile on the floor and settle inside the walls', () => {
  const s = createState(fakeWord(), MODE_FALL);
  destroyFall(s, swipe);
  run(s, 600);
  circlesInBounds(s, 2);
  for (let i = 0; i < 4; i++) {
    expect(Math.hypot(s.lvx[i]!, s.lvy[i]!)).toBeLessThan(20);
    expect(s.ly[i]!).toBeGreaterThan(200); // everything came down
  }
});

test('a zero-speed swipe drops the letters straight down', () => {
  const s = createState(fakeWord(), MODE_FALL);
  destroyFall(s, { sx: 0, sy: 0, ex: 0, ey: 0, speed: 0 });
  run(s, 300);
  circlesInBounds(s, 2);
});

test('rebuild flies the letters home upright', () => {
  const s = createState(fakeWord(), MODE_FALL);
  destroyFall(s, swipe);
  run(s, 300);
  s.phase = PHASE_REBUILDING;
  run(s, 150);
  expect(s.phase).toBe(PHASE_INTACT);
  expect(Array.from(s.lx)).toEqual([80, 160, 240, 320]);
  expect(Array.from(s.la)).toEqual([0, 0, 0, 0]);
});

test('a swipe during rebuild knocks them down again', () => {
  const s = createState(fakeWord(), MODE_FALL);
  destroyFall(s, swipe);
  run(s, 200);
  s.phase = PHASE_REBUILDING;
  run(s, 20);
  destroyFall(s, swipe);
  run(s, 300);
  expect(s.phase).toBe(PHASE_DESTROYED);
  circlesInBounds(s, 2);
});
