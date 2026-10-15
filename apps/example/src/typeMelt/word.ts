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
  topAnchors,
} from './sampling';
import { ROUND_EM } from './material';
import {
  ANCHORS_PER_LETTER,
  BOTTOM_ANCHORS,
  TOP_ANCHORS,
  CAP,
  CIRCLES_PER_LETTER,
  LETTERS,
  type WordData,
} from './state';

export const WORD = 'TGFX';
// A tall, condensed caps face, so inflated it reads like the reference's balloon type.
export const FAMILY = 'Bebas Neue';
export const FONT_FILES = [require('../assets/fonts/BebasNeue-Regular.ttf')];
/** Share of the canvas width the word spans, as in the reference. */
const FILL = 0.86;
/** Extra room between letters, in font sizes, so their tubes stay apart. */
const TRACK_EM = 0.06;
/** Fattening stroke before inflation, in font sizes; the narrow G gets less so its counter stays open. */
const STROKE_EM = 0.05;
const STROKE_EM_BY_LETTER: Record<string, number> = { G: 0.02 };

export interface Word {
  data: WordData;
  /** Letter outlines in letter-local points, centred on (0, 0). */
  paths: string[];
  /** Per letter: the round-join stroke that fattens it before it is inflated. */
  strokeWidths: number[];
  /** The widest of `strokeWidths`, for padding. */
  strokeWidth: number;
}

export function buildWord(width: number, height: number, seed = 7): Word {
  // Size the word to span FILL of the width, measured once at 100 pt.
  const em =
    measureText(WORD, { fontFamily: FAMILY, fontSize: 100 }).width / 100;
  const fontSize = Math.min(
    (width * FILL) / (em + TRACK_EM * (LETTERS - 1)),
    height * 0.5,
  );
  const track = fontSize * TRACK_EM;
  const style = { fontFamily: FAMILY, fontSize };
  const total = measureText(WORD, style).width + track * (LETTERS - 1);
  const left = (width - total) / 2;
  // Caps are about 0.7 em tall: centre them a little above the middle.
  const baseline = height * 0.42 + fontSize * 0.35;
  const spacing = fontSize * 0.045;
  const rand = mulberry32(seed);

  const cx = new Float32Array(LETTERS);
  const cy = new Float32Array(LETTERS);
  const w = new Float32Array(LETTERS);
  const h = new Float32Array(LETTERS);
  const circleR = new Float32Array(LETTERS);
  const tube = new Float32Array(LETTERS * 4);
  const anchors = new Float32Array(LETTERS * ANCHORS_PER_LETTER * 2).fill(NaN);
  const circles = new Float32Array(LETTERS * CIRCLES_PER_LETTER * 2);
  const homes: number[] = [];
  const paths: string[] = [];
  const strokeWidths: number[] = [];

  for (let i = 0; i < LETTERS; i++) {
    const raw = textToPath(WORD[i]!, style);
    const b = pathBounds(raw, true);
    const advance = i === 0 ? 0 : measureText(WORD.slice(0, i), style).width;
    const midX = b.x + b.width / 2;
    const midY = b.y + b.height / 2;
    cx[i] = left + advance + track * i + midX;
    cy[i] = baseline + midY;
    w[i] = b.width;
    h[i] = b.height;
    const local = pathTransform(raw, [1, 0, 0, 1, -midX, -midY]);
    paths.push(local);
    strokeWidths.push(fontSize * (STROKE_EM_BY_LETTER[WORD[i]!] ?? STROKE_EM));
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
      bottomAnchors(contains, box, BOTTOM_ANCHORS, spacing * 0.5),
      i * ANCHORS_PER_LETTER * 2,
    );
    anchors.set(
      topAnchors(contains, box, TOP_ANCHORS, spacing * 0.5),
      (i * ANCHORS_PER_LETTER + BOTTOM_ANCHORS) * 2,
    );
    circles.set(
      pickSpread(pts, CIRCLES_PER_LETTER),
      i * CIRCLES_PER_LETTER * 2,
    );
    // Condensed letters are tall and narrow: ten circles this size cover the outline.
    circleR[i] = Math.min(b.width, b.height) * 0.28;
    // The tube image's rect, padded so the rounded, fattened letter fits; the
    // mesh is laid over exactly this rect.
    const pad = strokeWidths[i]! / 2 + fontSize * ROUND_EM * 3 + 2;
    tube.set(
      [
        -b.width / 2 - pad,
        -b.height / 2 - pad,
        b.width + pad * 2,
        b.height + pad * 2,
      ],
      i * 4,
    );
  }

  const homeCount = Math.min(CAP, homes.length / 2);
  return {
    data: {
      width,
      height,
      // Just below the letters, where the reference's long drips land.
      floorY: baseline + fontSize * 0.3,
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
      tube,
      dropR: fontSize * 0.035,
      seed,
    },
    paths,
    strokeWidths,
    strokeWidth: Math.max(...strokeWidths),
  };
}
