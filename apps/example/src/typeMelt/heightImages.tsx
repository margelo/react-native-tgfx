import React from 'react';
import {
  Blur,
  Group,
  Path,
  imageFromPixels,
  pathBounds,
  renderToImage,
  type TgfxImage,
} from 'react-native-tgfx';
import { tubeHeights } from './heightField';
import { ROUND_EM, TUBE_EM } from './material';
import type { Word } from './word';

/** A letter's tube height image, placed in letter-local points. */
export interface HeightImage {
  image: TgfxImage;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Rasterises each letter once, rounded by a blur and re-thresholded so the
 * serifs soften into bubble type, and bends its distance field into a tube.
 * Done per letter so neighbouring letters never fuse in the distance step.
 */
export async function buildHeightImages(
  word: Word,
  scale: number,
): Promise<HeightImage[]> {
  const { fontSize } = word.data;
  const pad = word.strokeWidth / 2 + fontSize * ROUND_EM * 3 + 2;
  const out: HeightImage[] = [];
  try {
    for (let i = 0; i < word.paths.length; i++) {
      const path = word.paths[i]!;
      const b = pathBounds(path, true);
      const x = b.x - pad;
      const y = b.y - pad;
      const width = b.width + pad * 2;
      const height = b.height + pad * 2;
      const raster = await renderToImage(
        <Group transform={[{ translateX: -x }, { translateY: -y }]}>
          {/* tgfx takes the sigma in drawing pixels, not points. */}
          <Blur blur={fontSize * ROUND_EM * scale} />
          <Path path={path} color="white" />
          <Path
            path={path}
            color="white"
            style="stroke"
            strokeWidth={word.strokeWidths[i]}
            strokeJoin="round"
          />
        </Group>,
        { width, height, pixelRatio: scale },
      );
      const raw = new Uint8Array(await raster.encode('raw'));
      const w = raster.width;
      const h = raster.height;
      raster.dispose();
      const heights = tubeHeights(raw, w, h, fontSize * TUBE_EM * scale);
      out.push({
        image: imageFromPixels(heights.buffer as ArrayBuffer, w, h),
        x,
        y,
        width,
        height,
      });
    }
  } catch (error) {
    // Free what this build made before the failure; the caller gets the error.
    out.forEach(tube => tube.image.dispose());
    throw error;
  }
  return out;
}
