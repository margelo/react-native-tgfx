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
import { destroy, publish, rebuild, setMode, step } from '../../typeMelt/sim';
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
      s.phase === PHASE_DESTROYED && Array.from(s.melted).every(v => v > 0.999);
    expect(settle(s, flat, 40)).toBe(true);
    // It holds the puddle for a moment rather than snapping straight back.
    for (let k = 0; k < 60; k++) step(s, 1 / 60);
    expect(s.phase).toBe(PHASE_DESTROYED);
    expect(settle(s, () => s.phase === PHASE_INTACT, 10)).toBe(true);
    expect(settle(s, () => s.phase === PHASE_DESTROYED, 5)).toBe(true);
  });
});
