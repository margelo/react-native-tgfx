import React, { useEffect, useMemo, useState } from 'react';
import { PixelRatio } from 'react-native';
import { describe, expect, render, test } from 'react-native-harness';
import {
  createVertexBuffer,
  pathContains,
  useFonts,
  useOffscreenImage,
  useSpriteBuffer,
} from 'react-native-tgfx';
import { buildHeightImages, type HeightImage } from './typeMelt/heightImages';
import { BlobSprite, LiquidScene } from './typeMelt/LiquidScene';
import {
  MESH_INDICES,
  MESH_VERTS,
  gridIndices,
  gridTextures,
  writeMesh,
} from './typeMelt/meshMelt';
import { RIBBON_INDICES, RIBBON_VERTS } from './typeMelt/ribbon';
import {
  ANCHORS_PER_LETTER,
  BLOB,
  CAP,
  CIRCLES_PER_LETTER,
  LETTERS,
  MODE_MELT,
  createState,
} from './typeMelt/state';
import { FAMILY, FONT_FILES, buildWord, type Word } from './typeMelt/word';
import { Stage, STAGE_SIZE, sleep, snapshot } from './testSupport';

function useWord(width: number, height: number): Word | null {
  const ready = useFonts({ [FAMILY]: FONT_FILES });
  return useMemo(
    () => (ready ? buildWord(width, height) : null),
    [ready, width, height],
  );
}

async function wordAt(width: number, height: number): Promise<Word> {
  // A box, not a `let`: TS narrows a closure-assigned `let` to null for good.
  const box: { current: Word | null } = { current: null };
  function Probe() {
    box.current = useWord(width, height);
    return null;
  }
  await render(<Probe />);
  for (let k = 0; k < 50 && box.current === null; k++) {
    await sleep(20);
  }
  if (box.current === null) throw new Error('fonts never loaded');
  return box.current;
}

describe('TypeMelt word', () => {
  test('lays out four centred letters above the floor', async () => {
    const { data, paths } = await wordAt(390, 700);
    expect(paths).toHaveLength(LETTERS);
    for (let i = 0; i < LETTERS; i++) {
      expect(data.cx[i]! - data.w[i]! / 2).toBeGreaterThan(0);
      expect(data.cx[i]! + data.w[i]! / 2).toBeLessThan(390);
      expect(data.cy[i]! + data.h[i]! / 2).toBeLessThan(data.floorY);
      if (i > 0) expect(data.cx[i]!).toBeGreaterThan(data.cx[i - 1]!);
    }
  });

  test('droplet homes sit inside their letters and fit the sprite buffer', async () => {
    const { data, paths } = await wordAt(390, 700);
    // About 240 at this size with Bebas Neue: enough for a dense spray.
    expect(data.homeCount).toBeGreaterThan(150);
    expect(data.homeCount).toBeLessThanOrEqual(CAP);
    let inside = 0;
    for (let k = 0; k < data.homeCount; k++) {
      const x = data.homes[k * 2]!;
      const y = data.homes[k * 2 + 1]!;
      for (let i = 0; i < LETTERS; i++) {
        if (pathContains(paths[i]!, x - data.cx[i]!, y - data.cy[i]!)) {
          inside++;
          break;
        }
      }
    }
    expect(inside).toBe(data.homeCount);
  });

  test('every letter has drip anchors on its ink and a full set of collision circles', async () => {
    const { data, paths } = await wordAt(390, 700);
    for (let i = 0; i < LETTERS; i++) {
      let used = 0;
      for (let a = 0; a < ANCHORS_PER_LETTER; a++) {
        const o = (i * ANCHORS_PER_LETTER + a) * 2;
        const x = data.anchors[o]!;
        if (Number.isNaN(x)) continue;
        used++;
        expect(pathContains(paths[i]!, x, data.anchors[o + 1]!)).toBe(true);
      }
      expect(used).toBeGreaterThan(0);
      for (let k = 0; k < CIRCLES_PER_LETTER; k++) {
        const o = (i * CIRCLES_PER_LETTER + k) * 2;
        expect(Number.isFinite(data.circles[o]!)).toBe(true);
      }
    }
  });

  test('rebuilding at a new size rescales everything (rotation, split screen)', async () => {
    const portrait = await wordAt(390, 700);
    const landscape = await wordAt(844, 390);
    expect(landscape.data.width).toBe(844);
    expect(landscape.data.floorY).toBeLessThan(390);
    expect(landscape.data.fontSize).not.toBe(portrait.data.fontSize);
  });

  test('fits the 200 pt harness stage', async () => {
    const { data } = await wordAt(STAGE_SIZE, STAGE_SIZE);
    expect(data.cx[0]! - data.w[0]! / 2).toBeGreaterThan(0);
    expect(data.floorY).toBeLessThan(STAGE_SIZE);
  });
});

describe('TypeMelt material', () => {
  function Rest({
    reflection,
    onReady,
  }: {
    reflection: boolean;
    onReady: () => void;
  }) {
    const word = useWord(STAGE_SIZE, STAGE_SIZE);
    const sprites = useSpriteBuffer(16);
    const blob = useOffscreenImage(
      <BlobSprite />,
      { width: BLOB, height: BLOB, pixelRatio: 1 },
      [],
    );
    // The same mesh buffers the screen uses, with rest positions written once.
    const [meshes] = useState(() =>
      Array.from({ length: LETTERS }, () =>
        createVertexBuffer({
          maxVertices: MESH_VERTS,
          maxIndices: MESH_INDICES,
          textures: true,
        }),
      ),
    );
    const [ribbon] = useState(() =>
      createVertexBuffer({
        maxVertices: RIBBON_VERTS,
        maxIndices: RIBBON_INDICES,
        colors: true,
      }),
    );
    const [heights, setHeights] = useState<HeightImage[] | null>(null);
    useEffect(() => {
      if (word) buildHeightImages(word, PixelRatio.get()).then(setHeights);
    }, [word]);
    // Snapshot only once the tubes exist: building them outlasts the warm-up.
    useEffect(() => {
      if (heights && blob) onReady();
    }, [heights, blob, onReady]);
    if (!word || !heights) return null;
    const rest = createState(word.data, MODE_MELT);
    const indices = gridIndices();
    heights.forEach((h, i) => {
      const m = meshes[i]!;
      m.indices.set(indices);
      m.textures.set(gridTextures(h.image.width, h.image.height));
      writeMesh(rest, i, m.positions);
    });
    return (
      <LiquidScene
        word={word}
        heights={heights}
        meshes={meshes}
        ribbon={ribbon}
        letterOpacity={1}
        blob={blob}
        sprites={sprites}
        count={0}
        time={0}
        melt={0}
        reflection={reflection}
      />
    );
  }

  test('every letter gets a tube height image that covers it', async () => {
    // Pixel-level checks (peak inside, empty border) live in heightField.test.ts:
    // tgfx can't read back a fromPixels image.
    const word = await wordAt(STAGE_SIZE, STAGE_SIZE);
    const heights = await buildHeightImages(word, PixelRatio.get());
    expect(heights).toHaveLength(LETTERS);
    heights.forEach((h, i) => {
      expect(h.image.width).toBeGreaterThan(0);
      expect(h.image.height).toBeGreaterThan(0);
      // Letter-local, centred on the letter: the image spans its whole box.
      expect(h.x).toBeLessThan(-word.data.w[i]! / 2);
      expect(h.x + h.width).toBeGreaterThan(word.data.w[i]! / 2);
      expect(h.y).toBeLessThan(-word.data.h[i]! / 2);
      expect(h.y + h.height).toBeGreaterThan(word.data.h[i]! / 2);
      h.image.dispose();
    });
  });

  test('renders TGFX as liquid chrome at rest', async () => {
    let ready = () => {};
    const shown = new Promise<void>(resolve => (ready = resolve));
    await render(
      <Stage>
        <Rest reflection={false} onReady={ready} />
      </Stage>,
    );
    await shown;
    await snapshot('typemelt-rest', 800);
  });

  test('renders the floor reflection', async () => {
    let ready = () => {};
    const shown = new Promise<void>(resolve => (ready = resolve));
    await render(
      <Stage>
        <Rest reflection onReady={ready} />
      </Stage>,
    );
    await shown;
    await snapshot('typemelt-rest-reflection', 800);
  });
});
