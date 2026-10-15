const mockDisposed: string[] = [];
let mockCalls = 0;

jest.mock(
  'react-native-tgfx',
  () => ({
    Blur: () => null,
    Group: () => null,
    Path: () => null,
    pathBounds: () => ({ x: 0, y: 0, width: 2, height: 2 }),
    imageFromPixels: () => {
      const id = `tube${mockCalls}`;
      return { dispose: () => mockDisposed.push(id) };
    },
    renderToImage: async () => {
      mockCalls++;
      if (mockCalls === 3) throw new Error('offscreen context lost');
      return {
        width: 2,
        height: 2,
        encode: async () => new Uint8Array(16).buffer,
        dispose: () => mockDisposed.push(`raster${mockCalls}`),
      };
    },
  }),
  { virtual: true },
);

import { buildHeightImages } from '../../typeMelt/heightImages';
import type { Word } from '../../typeMelt/word';

const word = {
  data: { fontSize: 100, tube: new Float32Array(16).fill(10) },
  paths: ['M0 0', 'M0 0', 'M0 0', 'M0 0'],
  strokeWidth: 10,
  strokeWidths: [10, 10, 10, 10],
} as unknown as Word;

test('a failed letter build rejects and frees the tubes already made', async () => {
  await expect(buildHeightImages(word, 3)).rejects.toThrow(
    'offscreen context lost',
  );
  expect(mockDisposed).toEqual(
    expect.arrayContaining(['raster1', 'raster2', 'tube1', 'tube2']),
  );
});
