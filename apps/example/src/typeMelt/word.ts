// TGFX as geometry: centred letter paths, droplet homes, drip anchors and
// collision circles, all derived once per canvas size from the real font.
import {
  measureText,
  pathBounds,
  pathContains,
  pathTransform,
  textToPath,
} from 'react-native-tgfx';
import {
  bottomAnchors,
  mulberry32,
  pickSpread,
  sampleInside,
} from './sampling';
import {
  ANCHORS_PER_LETTER,
  CAP,
  CIRCLES_PER_LETTER,
  LETTERS,
  type WordData,
} from './state';

export const WORD = 'TGFX';
export const FAMILY = 'PT Serif';
export const FONT_FILES = [
  require('../assets/fonts/PT_Serif-Web-Regular.ttf'),
  require('../assets/fonts/PT_Serif-Web-Bold.ttf'),
];

export interface Word {
  data: WordData;
  /** Letter outlines in letter-local points, centred on (0, 0). */
  paths: string[];
  /** The round-join stroke that fattens the serif face into balloon type. */
  strokeWidth: number;
}

export function buildWord(width: number, height: number, seed = 7): Word {
  const fontSize = Math.min(width * 0.3, height * 0.42);
  const style = { fontFamily: FAMILY, fontWeight: 'bold' as const, fontSize };
  const total = measureText(WORD, style).width;
  const left = (width - total) / 2;
  const baseline = height * 0.48 + fontSize * 0.35;
  const spacing = fontSize * 0.045;
  const rand = mulberry32(seed);

  const cx = new Float32Array(LETTERS);
  const cy = new Float32Array(LETTERS);
  const w = new Float32Array(LETTERS);
  const h = new Float32Array(LETTERS);
  const circleR = new Float32Array(LETTERS);
  const anchors = new Float32Array(LETTERS * ANCHORS_PER_LETTER * 2).fill(NaN);
  const circles = new Float32Array(LETTERS * CIRCLES_PER_LETTER * 2);
  const homes: number[] = [];
  const paths: string[] = [];

  for (let i = 0; i < LETTERS; i++) {
    const raw = textToPath(WORD[i]!, style);
    const b = pathBounds(raw, true);
    const advance = i === 0 ? 0 : measureText(WORD.slice(0, i), style).width;
    const midX = b.x + b.width / 2;
    const midY = b.y + b.height / 2;
    cx[i] = left + advance + midX;
    cy[i] = baseline + midY;
    w[i] = b.width;
    h[i] = b.height;
    const local = pathTransform(raw, [1, 0, 0, 1, -midX, -midY]);
    paths.push(local);
    const contains = (x: number, y: number) => pathContains(local, x, y);
    const box = {
      x: -b.width / 2,
      y: -b.height / 2,
      width: b.width,
      height: b.height,
    };
    const pts = sampleInside(contains, box, spacing, rand);
    for (let k = 0; k < pts.length; k += 2) {
      homes.push(cx[i]! + pts[k]!, cy[i]! + pts[k + 1]!);
    }
    anchors.set(
      bottomAnchors(contains, box, ANCHORS_PER_LETTER, spacing * 0.5),
      i * ANCHORS_PER_LETTER * 2,
    );
    circles.set(
      pickSpread(pts, CIRCLES_PER_LETTER),
      i * CIRCLES_PER_LETTER * 2,
    );
    circleR[i] = Math.min(b.width, b.height) * 0.2;
  }

  const homeCount = Math.min(CAP, homes.length / 2);
  return {
    data: {
      width,
      height,
      floorY: baseline + fontSize * 0.7,
      fontSize,
      cx,
      cy,
      w,
      h,
      homes: Float32Array.from(homes.slice(0, homeCount * 2)),
      homeCount,
      anchors,
      circles,
      circleR,
      // Big enough that a lone droplet survives the blur's threshold.
      dropR: fontSize * 0.06,
      seed,
    },
    paths,
    strokeWidth: fontSize * 0.09,
  };
}
