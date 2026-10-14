import { destroyMelt, stepMelt } from '../../typeMelt/melt';
import {
  ANCHORS_PER_LETTER,
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

test('at rest each letter drips from one anchor, like the reference', () => {
  const s = createState(fakeWord(), MODE_MELT);
  run(s, 10);
  for (let i = 0; i < 4; i++) {
    let wet = 0;
    for (
      let a = i * ANCHORS_PER_LETTER;
      a < (i + 1) * ANCHORS_PER_LETTER;
      a++
    ) {
      if (s.stretch[a]! > 0) wet++;
    }
    expect(wet).toBe(1);
  }
  expect(s.n).toBe(POOL_BASE);
});

test('at least one resting drip reaches the floor and spreads into a foot', () => {
  const s = createState(fakeWord(), MODE_MELT);
  run(s, 10);
  const R = s.word.dropR * 1.2;
  let feet = 0;
  for (let a = 0; a < MAX_ANCHORS; a++) {
    const head = a * CHAIN + CHAIN - 1;
    if (s.r[head]! > 0 && s.py[head]! >= s.word.floorY - s.r[head]! - 0.5) {
      expect(s.r[head]!).toBeCloseTo(R * 1.5);
      feet++;
    }
  }
  expect(feet).toBeGreaterThanOrEqual(1);
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
  // Volume, not drop count: a full puddle swells its drops instead of adding more.
  const volume = (s: SimState) => {
    let v = 0;
    for (let k = POOL_BASE; k < s.n; k++) v += s.r[k]! * s.r[k]!;
    return v;
  };
  const s = createState(fakeWord(), MODE_MELT);
  destroyMelt(s, swipe);
  run(s, 4);
  const early = volume(s);
  run(s, 8);
  const later = volume(s);
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

test('a swipe speeds the melt up, but only modestly', () => {
  const timeToHalf = (speed: number) => {
    const s = createState(fakeWord(), MODE_MELT);
    destroyMelt(s, { sx: 40, sy: 250, ex: 360, ey: 250, speed });
    let k = 0;
    while (s.lsy[1]! > 0.5 && k++ < 6000) stepMelt(s, 1 / 60);
    return k;
  };
  const ratio = timeToHalf(0) / timeToHalf(4000);
  expect(ratio).toBeGreaterThan(1.1);
  expect(ratio).toBeLessThan(2);
});

test('drips travel down with their letter as it slumps', () => {
  const s = createState(fakeWord(), MODE_MELT);
  run(s, 6); // let the resting drips hang first
  destroyMelt(s, swipe);
  const R = s.word.dropR * 1.2;
  for (let t = 0; t < 12; t++) {
    run(s, 0.5);
    for (let a = 0; a < MAX_ANCHORS; a++) {
      const root = a * CHAIN;
      if (s.r[root]! === 0) continue;
      for (let j = 1; j < CHAIN; j++) {
        expect(s.py[root + j]!).toBeGreaterThanOrEqual(s.py[root]! - R);
      }
    }
  }
});

test('feeding the puddle never slingshots a strand above its letter', () => {
  const w = fakeWord();
  // Letter 0's outer anchors hang from a crossbar underside, high in the letter,
  // so their strands are long and feed the puddle hard.
  w.anchors[1] = -30;
  w.anchors[7] = -30;
  const s = createState(w, MODE_MELT);
  const dts = [1 / 60, 1 / 30, 1 / 120, 1 / 45];
  for (let k = 0; k < 360; k++) stepMelt(s, dts[k % 4]!);
  destroyMelt(s, { sx: 40, sy: 250, ex: 360, ey: 250, speed: 3500 });
  const R = s.word.dropR * 1.2;
  for (let k = 0; k < 900; k++) {
    stepMelt(s, dts[k % 4]!);
    for (let a = 0; a < MAX_ANCHORS; a++) {
      const root = a * CHAIN;
      if (s.r[root]! === 0) continue;
      for (let j = 1; j < CHAIN; j++) {
        expect(s.py[root + j]!).toBeGreaterThanOrEqual(s.py[root]! - R);
      }
    }
  }
});

test('dry anchors draw nothing at rest, so letter bottoms stay smooth', () => {
  const s = createState(fakeWord(), MODE_MELT);
  run(s, 10);
  for (let a = 0; a < MAX_ANCHORS; a++) {
    if (s.stretch[a]! > 0) continue;
    for (let j = 0; j < CHAIN; j++) expect(s.r[a * CHAIN + j]).toBe(0);
  }
});

test('a resting drip hangs from the bottom edge, not from under an arm', () => {
  const w = fakeWord();
  // Letter 0: three anchors under an arm, high in the letter; one on its bottom edge.
  w.anchors[1] = -30;
  w.anchors[3] = -30;
  w.anchors[7] = -30;
  const s = createState(w, MODE_MELT);
  expect(s.reach[2]).toBeGreaterThan(0);
  expect(s.reach[0]).toBe(0);
  expect(s.reach[1]).toBe(0);
  expect(s.reach[3]).toBe(0);
});
