import { SPRITE_FLOATS } from 'react-native-tgfx';
import {
  BLOB,
  MODE_EXPLODE,
  MODE_FALL,
  MODE_MELT,
  PHASE_DESTROYED,
  PHASE_INTACT,
  PHASE_REBUILDING,
  createState,
} from '../../typeMelt/state';
import { MESH_VERTS, updateMelted } from '../../typeMelt/meshMelt';
import {
  createPacer,
  destroy,
  pace,
  publish,
  rebuild,
  setMode,
  step,
} from '../../typeMelt/sim';
import { fakeWord } from '../../__fixtures__/typeMelt/fakeWord';

// The package's build output isn't present under Jest, so the mock is virtual.
jest.mock('react-native-tgfx', () => ({ SPRITE_FLOATS: 7 }), { virtual: true });

const swipe = { sx: 60, sy: 200, ex: 200, ey: 210, speed: 2500 };

test('a huge dt is clamped: nothing tunnels through the floor or goes NaN', () => {
  for (const mode of [MODE_MELT, MODE_EXPLODE, MODE_FALL]) {
    const s = createState(fakeWord(), mode);
    destroy(s, swipe);
    step(s, 5);
    step(s, -1);
    step(s, NaN);
    for (let i = 0; i < s.n; i++) {
      expect(Number.isFinite(s.py[i]!)).toBe(true);
      expect(s.py[i]!).toBeLessThanOrEqual(s.word.floorY);
    }
    for (let i = 0; i < 4; i++) expect(Number.isFinite(s.ly[i]!)).toBe(true);
    expect(s.t).toBeLessThanOrEqual(1 / 30 + 1e-9);
  }
});

test('setMode from intact rebuilds into the new mode', () => {
  const s = createState(fakeWord(), MODE_MELT);
  for (let k = 0; k < 120; k++) step(s, 1 / 60); // let intact drips grow
  setMode(s, MODE_FALL);
  expect(s.phase).toBe(PHASE_REBUILDING);
  for (let k = 0; k < 240; k++) step(s, 1 / 60);
  expect(s.mode).toBe(MODE_FALL);
  expect(s.phase).toBe(PHASE_INTACT);
  expect(s.n).toBe(0);
});

test('switching mode mid-destroy finishes the old rebuild first, and ignores swipes meanwhile', () => {
  const s = createState(fakeWord(), MODE_EXPLODE);
  destroy(s, swipe);
  for (let k = 0; k < 60; k++) step(s, 1 / 60);
  setMode(s, MODE_MELT);
  destroy(s, swipe); // ignored: a switch is pending
  expect(s.phase).toBe(PHASE_REBUILDING);
  // Stop the moment the switch lands: melt mode starts melting by itself soon after.
  for (let k = 0; k < 300 && s.mode !== MODE_MELT; k++) step(s, 1 / 60);
  expect(s.mode).toBe(MODE_MELT);
  expect(s.phase).toBe(PHASE_INTACT);
  expect(s.letterOpacity).toBe(1);
});

test('setMode to the current intact mode is a no-op', () => {
  const s = createState(fakeWord(), MODE_FALL);
  setMode(s, MODE_FALL);
  expect(s.phase).toBe(PHASE_INTACT);
});

test('rebuild only starts from destroyed', () => {
  const s = createState(fakeWord(), MODE_FALL);
  rebuild(s);
  expect(s.phase).toBe(PHASE_INTACT);
  destroy(s, swipe);
  expect(s.phase).toBe(PHASE_DESTROYED);
  rebuild(s);
  expect(s.phase).toBe(PHASE_REBUILDING);
});

const meshes = () =>
  Array.from({ length: 4 }, () => new Float32Array(MESH_VERTS * 2));

test('publish writes sprites, letter meshes, and a count that always moves', () => {
  const s = createState(fakeWord(), MODE_EXPLODE);
  destroy(s, swipe);
  step(s, 1 / 60);
  const f = new Float32Array(s.n * SPRITE_FLOATS);
  const v = () => ({ value: -1 });
  const m = meshes();
  const opacity = v();
  const count = v();
  const melt = v();
  publish(s, f, m, opacity, count, melt, 1234.5);
  expect(melt.value).toBe(0);
  expect(f[4]).toBeCloseTo(s.r[0]! / (BLOB / 2));
  expect(f[5]).toBe(s.px[0]);
  expect(f[6]).toBe(s.py[0]);
  // Letter 2's mesh starts at its tube rect's top-left corner, at home.
  expect(m[2]![0]).toBeCloseTo(240 - 35);
  expect(m[2]![1]).toBeCloseTo(200 - 55);
  expect(opacity.value).toBe(0);
  expect(Math.floor(count.value)).toBe(s.n);
  expect(count.value).not.toBe(s.n);
});

test('publish reports how melted the word is and bends its meshes', () => {
  const s = createState(fakeWord(), MODE_MELT);
  s.meltT = 30;
  updateMelted(s);
  const v = () => ({ value: -1 });
  const m = meshes();
  const melt = v();
  publish(s, new Float32Array(s.n * SPRITE_FLOATS), m, v(), v(), melt, 0);
  expect(melt.value).toBeGreaterThan(0.5);
  // The top-left vertex of a melted letter has come down near the floor.
  expect(m[0]![1]!).toBeGreaterThan(250);
});

describe('melt runs by itself', () => {
  const settle = (
    s: ReturnType<typeof createState>,
    until: () => boolean,
    seconds: number,
  ) => {
    for (let k = 0; k < seconds * 60 && !until(); k++) step(s, 1 / 60);
    return until();
  };

  test('melt mode starts melting on its own', () => {
    const s = createState(fakeWord(), MODE_MELT);
    for (let k = 0; k < 180; k++) step(s, 1 / 60);
    expect(s.phase).toBe(PHASE_DESTROYED);
  });

  test('a swipe does nothing in melt mode', () => {
    const s = createState(fakeWord(), MODE_MELT);
    destroy(s, swipe);
    expect(s.phase).toBe(PHASE_INTACT);
  });

  test('with auto-melt off the word stays at rest', () => {
    const s = createState(fakeWord(), MODE_MELT);
    s.autoMelt = false;
    for (let k = 0; k < 600; k++) step(s, 1 / 60);
    expect(s.phase).toBe(PHASE_INTACT);
  });

  test('after melting completely it holds, rebuilds, then melts again', () => {
    const s = createState(fakeWord(), MODE_MELT);
    const flat = () =>
      s.phase === PHASE_DESTROYED && Array.from(s.melted).every(v => v >= 0.97);
    expect(settle(s, flat, 40)).toBe(true);
    // It holds the puddle for a moment rather than snapping straight back.
    for (let k = 0; k < 60; k++) step(s, 1 / 60);
    expect(s.phase).toBe(PHASE_DESTROYED);
    expect(settle(s, () => s.phase === PHASE_INTACT, 10)).toBe(true);
    expect(settle(s, () => s.phase === PHASE_DESTROYED, 5)).toBe(true);
  });
});

test('publish hands the renderer only the sprites that are visible', () => {
  const s = createState(fakeWord(), MODE_MELT);
  for (let k = 0; k < 120; k++) step(s, 1 / 60);
  let visible = 0;
  for (let q = 0; q < s.n; q++) if (s.r[q]! > 0) visible++;
  expect(visible).toBeLessThan(s.n);
  const f = new Float32Array(s.n * SPRITE_FLOATS);
  const count = { value: -1 };
  publish(s, f, meshes(), { value: 0 }, count, { value: 0 }, 0);
  expect(Math.floor(count.value)).toBe(visible);
  for (let q = 0; q < visible; q++)
    expect(f[q * SPRITE_FLOATS + 4]!).toBeGreaterThan(0);
});

describe('frame pacing', () => {
  const run = (vsyncMs: number, seconds: number, hz = 60) => {
    const p = createPacer();
    let frames = 0;
    let advanced = 0;
    for (let t = 0; t < seconds * 1000; t += vsyncMs) {
      const dt = pace(p, vsyncMs, 1000 / hz);
      if (dt > 0) {
        frames++;
        advanced += dt;
      }
    }
    return { frames, advanced };
  };

  test('on a 120 Hz display it advances 60 times a second', () => {
    const { frames } = run(1000 / 120, 10);
    expect(frames).toBeGreaterThanOrEqual(598);
    expect(frames).toBeLessThanOrEqual(601);
  });

  test('on a 60 Hz display it advances every frame', () => {
    expect(run(1000 / 60, 10).frames).toBeGreaterThanOrEqual(599);
  });

  test('on a 90 Hz display it still holds 60 a second', () => {
    const { frames } = run(1000 / 90, 10);
    expect(frames).toBeGreaterThanOrEqual(590);
    expect(frames).toBeLessThanOrEqual(601);
  });

  test('time is never lost: the advanced seconds match the wall clock', () => {
    const { advanced } = run(1000 / 120, 10);
    expect(advanced).toBeCloseTo(10, 1);
  });

  test('set to 120 Hz on a 120 Hz display it advances every frame', () => {
    const { frames, advanced } = run(1000 / 120, 10, 120);
    expect(frames).toBeGreaterThanOrEqual(1199);
    expect(advanced).toBeCloseTo(10, 1);
  });

  test('set to 120 Hz on a 60 Hz display it advances every frame it gets', () => {
    expect(run(1000 / 60, 10, 120).frames).toBeGreaterThanOrEqual(599);
  });

  test('switching rate mid-run takes effect on the next frame', () => {
    const p = createPacer();
    let frames = 0;
    for (let k = 0; k < 120; k++)
      if (pace(p, 1000 / 120, 1000 / 60) > 0) frames++;
    for (let k = 0; k < 120; k++)
      if (pace(p, 1000 / 120, 1000 / 120) > 0) frames++;
    expect(frames).toBeGreaterThanOrEqual(60 + 119);
  });

  test('a long stall advances once, not in a burst of catch-up frames', () => {
    const p = createPacer();
    expect(pace(p, 2000, 1000 / 60)).toBeGreaterThan(0);
    expect(pace(p, 8, 1000 / 60)).toBe(0);
  });
});
