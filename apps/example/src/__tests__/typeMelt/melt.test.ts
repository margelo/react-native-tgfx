// apps/example/src/__tests__/typeMelt/melt.test.ts
import { SAG, destroyMelt, stepMelt } from '../../typeMelt/melt';
import {
  CHAIN,
  MAX_ANCHORS,
  MODE_MELT,
  PHASE_DESTROYED,
  PHASE_INTACT,
  PHASE_REBUILDING,
  createState,
  type SimState,
} from '../../typeMelt/state';
import { fakeWord } from '../../__fixtures__/typeMelt/fakeWord';

const swipe = { sx: 40, sy: 260, ex: 360, ey: 260, speed: 2000 };

function run(s: SimState, steps: number) {
  for (let k = 0; k < steps; k++) {
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

test('intact drips hang but stop well short of the floor', () => {
  const s = createState(fakeWord(), MODE_MELT);
  run(s, 600);
  const bottom = 250; // fakeWord letters end at y = 250, floor at 300
  expect(lowestHead(s)).toBeGreaterThan(bottom + 4);
  expect(lowestHead(s)).toBeLessThan(bottom + 0.35 * 50 + 1);
});

test('destroy sags the letters and drips reach the floor without passing it', () => {
  const s = createState(fakeWord(), MODE_MELT);
  destroyMelt(s, swipe);
  expect(s.phase).toBe(PHASE_DESTROYED);
  run(s, 900);
  for (let i = 0; i < 4; i++) {
    expect(s.lsy[i]).toBeCloseTo(SAG, 2);
    // The letter's bottom edge stays put while it sags.
    expect(s.ly[i]! + (s.word.h[i]! / 2) * s.lsy[i]!).toBeCloseTo(250, 0);
  }
  for (let k = 0; k < s.n; k++) {
    if (s.r[k]! === 0) continue;
    expect(Number.isFinite(s.py[k]!)).toBe(true);
    expect(s.py[k]!).toBeLessThanOrEqual(s.word.floorY - s.r[k]! + 1e-3);
  }
  expect(lowestHead(s)).toBeGreaterThan(s.word.floorY - 10);
});

test('anchors near the swipe drip faster', () => {
  const s = createState(fakeWord(), MODE_MELT);
  destroyMelt(s, { sx: 60, sy: 255, ex: 100, ey: 255, speed: 3000 });
  expect(s.boost[0]!).toBeGreaterThan(0);
  expect(s.boost[MAX_ANCHORS - 1]!).toBe(0);
});

test('a zero-speed swipe still destroys and stays finite', () => {
  const s = createState(fakeWord(), MODE_MELT);
  destroyMelt(s, { sx: 100, sy: 250, ex: 100, ey: 250, speed: 0 });
  run(s, 120);
  for (let k = 0; k < s.n; k++) expect(Number.isFinite(s.py[k]!)).toBe(true);
});

test('rebuild retracts every drip and unsags the letters', () => {
  const s = createState(fakeWord(), MODE_MELT);
  destroyMelt(s, swipe);
  run(s, 600);
  s.phase = PHASE_REBUILDING;
  // Stop the moment it lands: intact melt mode starts dripping again right after.
  for (let k = 0; k < 240 && s.phase !== PHASE_INTACT; k++) stepMelt(s, 1 / 60);
  expect(s.phase).toBe(PHASE_INTACT);
  for (let a = 0; a < MAX_ANCHORS; a++) expect(s.stretch[a]).toBe(0);
  for (let i = 0; i < 4; i++) expect(s.lsy[i]).toBe(1);
});

test('a swipe during rebuild melts again', () => {
  const s = createState(fakeWord(), MODE_MELT);
  destroyMelt(s, swipe);
  run(s, 300);
  s.phase = PHASE_REBUILDING;
  run(s, 30);
  destroyMelt(s, swipe);
  run(s, 60);
  expect(s.phase).toBe(PHASE_DESTROYED);
  expect(s.lsy[0]!).toBeLessThan(1);
});
