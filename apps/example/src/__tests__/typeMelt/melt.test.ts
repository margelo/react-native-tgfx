import { destroyMelt, stepMelt } from '../../typeMelt/melt';
import {
  CHAIN,
  MAX_ANCHORS,
  MODE_MELT,
  PHASE_DESTROYED,
  PHASE_INTACT,
  PHASE_REBUILDING,
  POOL_BASE,
  createState,
  type SimState,
} from '../../typeMelt/state';
import { fakeWord } from '../../__fixtures__/typeMelt/fakeWord';

const swipe = { sx: 40, sy: 260, ex: 360, ey: 260, speed: 2000 };

function run(s: SimState, seconds: number) {
  for (let k = 0; k < seconds * 60; k++) {
    stepMelt(s, 1 / 60);
  }
}

function lowestHead(s: SimState) {
  let y = -Infinity;
  for (let a = 0; a < MAX_ANCHORS; a++) {
    if (s.r[a * CHAIN]! > 0) y = Math.max(y, s.py[a * CHAIN + CHAIN - 1]!);
  }
  return y;
}

/** Where letter i's bottom edge is, given its slump. */
const bottomOf = (s: SimState, i: number) =>
  s.ly[i]! + (s.word.h[i]! / 2) * s.lsy[i]!;

test('intact drips hang but stop well short of the floor, with no puddle', () => {
  const s = createState(fakeWord(), MODE_MELT);
  run(s, 10);
  const bottom = 250; // fakeWord letters end at y = 250, floor at 300
  expect(lowestHead(s)).toBeGreaterThan(bottom + 4);
  expect(lowestHead(s)).toBeLessThan(bottom + 0.35 * 50 + 1);
  expect(s.n).toBe(POOL_BASE);
});

test('once destroyed, the letters keep melting until nothing stands', () => {
  const s = createState(fakeWord(), MODE_MELT);
  destroyMelt(s, swipe);
  expect(s.phase).toBe(PHASE_DESTROYED);
  let last = 1;
  for (let t = 0; t < 30; t++) {
    run(s, 1);
    for (let i = 0; i < 4; i++)
      expect(s.lsy[i]!).toBeLessThanOrEqual(last + 1e-6);
    last = Math.max(s.lsy[0]!, s.lsy[1]!, s.lsy[2]!, s.lsy[3]!);
  }
  for (let i = 0; i < 4; i++) {
    expect(s.lsy[i]!).toBeLessThan(0.02);
    // Each letter has slumped all the way down onto the floor.
    expect(bottomOf(s, i)).toBeCloseTo(s.word.floorY, 0);
  }
});

test('the puddle grows while the letters melt, and stays on the floor', () => {
  const s = createState(fakeWord(), MODE_MELT);
  destroyMelt(s, swipe);
  run(s, 4);
  const early = s.n - POOL_BASE;
  run(s, 8);
  const later = s.n - POOL_BASE;
  expect(early).toBeGreaterThan(0);
  expect(later).toBeGreaterThan(early);
  for (let k = POOL_BASE; k < s.n; k++) {
    expect(Number.isFinite(s.px[k]!)).toBe(true);
    expect(s.r[k]!).toBeGreaterThan(0);
    expect(s.py[k]!).toBeLessThanOrEqual(s.word.floorY);
    expect(s.px[k]!).toBeGreaterThanOrEqual(0);
    expect(s.px[k]!).toBeLessThanOrEqual(s.word.width);
  }
});

test('drip chains never pass through the floor', () => {
  const s = createState(fakeWord(), MODE_MELT);
  destroyMelt(s, swipe);
  for (let t = 0; t < 20; t++) {
    run(s, 1);
    for (let k = 0; k < POOL_BASE; k++) {
      if (s.r[k]! === 0) continue;
      expect(Number.isFinite(s.py[k]!)).toBe(true);
      expect(s.py[k]!).toBeLessThanOrEqual(s.word.floorY - s.r[k]! + 1e-3);
    }
  }
});

test('anchors near the swipe drip faster', () => {
  const s = createState(fakeWord(), MODE_MELT);
  destroyMelt(s, { sx: 60, sy: 255, ex: 100, ey: 255, speed: 3000 });
  expect(s.boost[0]!).toBeGreaterThan(0);
  expect(s.boost[MAX_ANCHORS - 1]!).toBe(0);
});

test('a zero-speed swipe still melts and stays finite', () => {
  const s = createState(fakeWord(), MODE_MELT);
  destroyMelt(s, { sx: 100, sy: 250, ex: 100, ey: 250, speed: 0 });
  run(s, 3);
  for (let k = 0; k < s.n; k++) expect(Number.isFinite(s.py[k]!)).toBe(true);
  expect(s.lsy[0]!).toBeLessThan(1);
});

test('rebuild from a full melt stands the letters back up and drains the puddle', () => {
  const s = createState(fakeWord(), MODE_MELT);
  destroyMelt(s, swipe);
  run(s, 30);
  s.phase = PHASE_REBUILDING;
  // Stop the moment it lands: intact melt mode starts dripping again right after.
  for (let k = 0; k < 240 && s.phase !== PHASE_INTACT; k++) stepMelt(s, 1 / 60);
  expect(s.phase).toBe(PHASE_INTACT);
  expect(s.n).toBe(POOL_BASE);
  for (let a = 0; a < MAX_ANCHORS; a++) expect(s.stretch[a]).toBe(0);
  for (let i = 0; i < 4; i++) {
    expect(s.lsy[i]).toBe(1);
    expect(s.ly[i]).toBe(200);
  }
});

test('a swipe during rebuild melts again', () => {
  const s = createState(fakeWord(), MODE_MELT);
  destroyMelt(s, swipe);
  run(s, 5);
  s.phase = PHASE_REBUILDING;
  run(s, 0.5);
  destroyMelt(s, swipe);
  const before = s.lsy[0]!;
  run(s, 1);
  expect(s.phase).toBe(PHASE_DESTROYED);
  expect(s.lsy[0]!).toBeLessThan(before);
});
