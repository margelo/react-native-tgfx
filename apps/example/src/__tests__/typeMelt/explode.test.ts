// apps/example/src/__tests__/typeMelt/explode.test.ts
import { destroyExplode, stepExplode } from '../../typeMelt/explode';
import {
  MODE_EXPLODE,
  PHASE_DESTROYED,
  PHASE_INTACT,
  PHASE_REBUILDING,
  createState,
  type SimState,
} from '../../typeMelt/state';
import { fakeWord } from '../../__fixtures__/typeMelt/fakeWord';

const swipe = { sx: 60, sy: 200, ex: 200, ey: 210, speed: 2500 };

function run(s: SimState, steps: number) {
  for (let k = 0; k < steps; k++) {
    stepExplode(s, 1 / 60);
  }
}

function assertInBounds(s: SimState) {
  for (let i = 0; i < s.n; i++) {
    expect(Number.isFinite(s.px[i]!)).toBe(true);
    expect(Number.isFinite(s.py[i]!)).toBe(true);
    expect(s.py[i]!).toBeLessThanOrEqual(s.word.floorY - s.r[i]! + 1e-3);
    expect(s.px[i]!).toBeGreaterThanOrEqual(s.r[i]! - 1e-3);
    expect(s.px[i]!).toBeLessThanOrEqual(s.word.width - s.r[i]! + 1e-3);
  }
}

test('destroy swaps the letters for droplets at their homes', () => {
  const s = createState(fakeWord(), MODE_EXPLODE);
  destroyExplode(s, swipe);
  expect(s.phase).toBe(PHASE_DESTROYED);
  expect(s.letterOpacity).toBe(0);
  expect(s.n).toBe(s.word.homeCount);
  expect(s.px[0]).toBeCloseTo(s.word.homes[0]!);
});

test('droplets near the swipe move faster than far ones', () => {
  const s = createState(fakeWord(), MODE_EXPLODE);
  destroyExplode(s, swipe);
  let near = 0;
  let far = 0;
  for (let i = 0; i < s.n; i++) {
    const speed = Math.hypot(s.vx[i]!, s.vy[i]!);
    if (s.px[i]! > 180 && s.px[i]! < 220) near = Math.max(near, speed);
    if (s.px[i]! > 320) far = Math.max(far, speed);
  }
  expect(near).toBeGreaterThan(far * 2);
});

test('debris stays inside the walls and above the floor', () => {
  const s = createState(fakeWord(), MODE_EXPLODE);
  destroyExplode(s, swipe);
  run(s, 300);
  assertInBounds(s);
});

test('a zero-length, zero-speed swipe stays finite', () => {
  const s = createState(fakeWord(), MODE_EXPLODE);
  destroyExplode(s, { sx: 100, sy: 200, ex: 100, ey: 200, speed: 0 });
  run(s, 60);
  assertInBounds(s);
});

test('rebuild returns every droplet home, then fades the letters back in', () => {
  const s = createState(fakeWord(), MODE_EXPLODE);
  destroyExplode(s, swipe);
  run(s, 120);
  s.phase = PHASE_REBUILDING;
  run(s, 150);
  expect(s.phase).toBe(PHASE_INTACT);
  expect(s.n).toBe(0);
  expect(s.letterOpacity).toBe(1);
});

test('a swipe during rebuild explodes again from where the droplets are', () => {
  const s = createState(fakeWord(), MODE_EXPLODE);
  destroyExplode(s, swipe);
  run(s, 60);
  s.phase = PHASE_REBUILDING;
  run(s, 20);
  const x = s.px[10]!;
  destroyExplode(s, swipe);
  expect(s.phase).toBe(PHASE_DESTROYED);
  expect(s.px[10]).toBe(x);
  expect(s.letterOpacity).toBe(0);
});
