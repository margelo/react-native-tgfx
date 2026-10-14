import { distanceInside, tubeHeights } from '../../typeMelt/heightField';

/** RGBA bytes whose alpha is 255 where `inside(x, y)`. */
function maskOf(w: number, h: number, inside: (x: number, y: number) => boolean) {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[(y * w + x) * 4 + 3] = inside(x, y) ? 255 : 0;
    }
  }
  return out;
}

test('distanceInside matches brute force on an irregular mask', () => {
  const w = 13;
  const h = 11;
  const inside = (x: number, y: number) =>
    x > 1 && y > 1 && x < 11 && y < 9 && !(x > 5 && y > 4 && x < 8);
  const d = distanceInside(maskOf(w, h, inside), w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = Infinity;
      for (let v = 0; v < h; v++) {
        for (let u = 0; u < w; u++) {
          if (!inside(u, v)) best = Math.min(best, Math.hypot(u - x, v - y));
        }
      }
      expect(d[y * w + x]).toBeCloseTo(inside(x, y) ? best : 0, 4);
    }
  }
});

test('a wide stripe gets a circular profile R deep, flat beyond it', () => {
  const w = 60;
  const h = 5;
  const R = 10;
  // Inside from x = 5 to 54: distance to the outside is x - 4 on the left edge.
  const px = tubeHeights(maskOf(w, h, x => x >= 5 && x <= 54), w, h, R);
  for (let x = 5; x < 30; x++) {
    const u = Math.min((x - 4) / R, 1);
    const want = Math.round(255 * Math.sqrt(1 - (1 - u) * (1 - u)));
    expect(Math.abs(px[(2 * w + x) * 4 + 3]! - want)).toBeLessThanOrEqual(1);
  }
  expect(px[(2 * w + 30) * 4 + 3]).toBe(255);
});

test('heights are premultiplied white and zero outside', () => {
  const w = 41;
  const px = tubeHeights(maskOf(w, w, (x, y) => Math.hypot(x - 20, y - 20) <= 15), w, w, 15);
  for (let i = 0; i < w * w; i++) {
    const a = px[i * 4 + 3]!;
    expect(px[i * 4]).toBe(a);
    expect(px[i * 4 + 1]).toBe(a);
    expect(px[i * 4 + 2]).toBe(a);
  }
  expect(px[(20 * w + 20) * 4 + 3]).toBeGreaterThan(250);
  expect(px[(20 * w + 35) * 4 + 3]).toBeLessThan(120);
  expect(px[(20 * w + 37) * 4 + 3]).toBe(0);
});

test('an empty mask stays empty', () => {
  const px = tubeHeights(new Uint8Array(8 * 8 * 4), 8, 8, 4);
  expect(px.every(v => v === 0)).toBe(true);
});
