// Layouts and motion shared by both engines, so every scene draws the same
// geometry with the same colors on each side.
import { Dimensions } from 'react-native';

export const { width: W, height: H } = Dimensions.get('window');
export const CX = W / 2;
export const CY = H / 2;
export const BG = '#101014';

export const PALETTE = [
  '#FF3B30', '#FF9500', '#FFCC00', '#34C759',
  '#5AC8FA', '#007AFF', '#5856D6', '#AF52DE',
];

export interface Shape {
  x: number;
  y: number;
  size: number;
  /** Index into PALETTE. */
  which: number;
  color: string;
  circle: boolean;
}

// Rects and circles interleaved (every third one a circle), so an engine that
// only merges adjacent same-type draws gets nothing for free.
export function makeShapes(count: number, cols: number, rowStep: number): Shape[] {
  return Array.from({ length: count }, (_, i) => ({
    x: (i % cols) * (W / cols),
    y: Math.floor(i / cols) * rowStep,
    size: W / cols - 1,
    which: i % PALETTE.length,
    color: PALETTE[i % PALETTE.length],
    circle: i % 3 === 0,
  }));
}

// The static `shapes` scene, also the 20k layout of the animated scenes.
export const SHAPES = makeShapes(20000, 80, H / 250);
// `anim-decl` binds two derived values per shape; 20k of those measures
// Reanimated's mapper graph rather than either engine.
export const SHAPES_5K = makeShapes(5000, 40, H / 125);

// Every shape orbits its home on its own phase and speed: no two shapes share a
// transform, so nothing can be hoisted into a group. `t` runs 0..2π every 4 s
// and the speeds are whole numbers, so the motion loops without a jump.
export const ORBIT = 6;
export function orbitX(i: number, t: number): number {
  'worklet';
  return ORBIT * Math.cos(t * (1 + (i % 3)) + i * 0.618);
}
export function orbitY(i: number, t: number): number {
  'worklet';
  return ORBIT * Math.sin(t * (1 + (i % 3)) + i * 0.618);
}

// Flat copies for the per-frame worklets: a plain number array crosses into
// the UI runtime once, at worklet creation, and is cheap to index.
export function centres(shapes: Shape[]): number[] {
  const out: number[] = new Array(shapes.length * 2);
  shapes.forEach((s, i) => {
    out[i * 2] = s.x + s.size / 2;
    out[i * 2 + 1] = s.y + s.size / 2;
  });
  return out;
}
export const SHAPES_CENTRES = centres(SHAPES);
export const SHAPES_CIRCLE = SHAPES.map(s => (s.circle ? 1 : 0));
export const SHAPES_WHICH = SHAPES.map(s => s.which);
export const SHAPE_SIZE = SHAPES[0].size;

// anim-imp runs on the 5k layout: tgfx's node handles wedge the JS thread at
// 20k (11.6 s just to create them on an S25 Edge, and per-frame writes never
// finish a frame), and both engines must draw the same scene.
export const IMP_SHAPES = SHAPES_5K;
export const IMP_CENTRES = centres(IMP_SHAPES);
export const IMP_CIRCLE = IMP_SHAPES.map(s => (s.circle ? 1 : 0));
export const IMP_WHICH = IMP_SHAPES.map(s => s.which);
export const IMP_SIZE = IMP_SHAPES[0].size;
