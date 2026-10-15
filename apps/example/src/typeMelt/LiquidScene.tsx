import React from 'react';
import { PixelRatio } from 'react-native';
import {
  Atlas,
  BlendColor,
  Blur,
  Circle,
  Fill,
  Group,
  LinearGradient,
  RadialGradient,
  Rect,
  RuntimeShader,
  TgfxImage,
  type SpriteBuffer,
} from 'react-native-tgfx';
import type { HeightImage } from './heightImages';
import {
  CHROME_SOURCE,
  chromeUniforms,
  FINISHES,
  softBlurPx,
  type FinishName,
} from './material';
import type { LetterValues, Value } from './sim';
import { BLOB } from './state';
import type { Word } from './word';

export interface LiquidSceneProps {
  word: Word;
  /** Per-letter tube heights; nothing is drawn for the letters until they exist. */
  heights: HeightImage[] | null;
  letters: LetterValues[];
  letterOpacity: Value | number;
  blob: TgfxImage | null;
  sprites: SpriteBuffer;
  count: Value | number;
  time: Value | number;
  /** How melted the word is, 0..1: the shader softens the surface as it grows. */
  melt: Value | number;
  /** Defaults to the reference's iridescent glass. */
  finish?: FinishName;
  reflection?: boolean;
}

/** The droplet texture: a sphere's height profile, alpha = sqrt(1 - r²). */
export function BlobSprite() {
  const c = BLOB / 2;
  return (
    <Circle cx={c} cy={c} r={c}>
      <RadialGradient
        center={{ x: c, y: c }}
        r={c}
        colors={[
          '#ffffffff',
          '#ffffffF3',
          '#ffffffDD',
          '#ffffffB6',
          '#ffffff86',
          '#ffffff50',
          '#ffffff00',
        ]}
        positions={[0, 0.3, 0.5, 0.7, 0.85, 0.95, 1]}
      />
    </Circle>
  );
}

/** The height field itself: tube letters and sphere droplets, white with alpha = height. */
function HeightField({
  heights,
  letters,
  letterOpacity,
  blob,
  sprites,
  count,
}: LiquidSceneProps) {
  return (
    <>
      <Group opacity={letterOpacity}>
        {heights?.map((tube, i) => (
          <Group
            key={i}
            transform={[
              { translateX: letters[i]!.x },
              { translateY: letters[i]!.y },
              { rotate: letters[i]!.rot },
              { scaleX: letters[i]!.sx },
              { scaleY: letters[i]!.sy },
            ]}
          >
            <TgfxImage
              image={tube.image}
              x={tube.x}
              y={tube.y}
              width={tube.width}
              height={tube.height}
              fit="fill"
            />
          </Group>
        ))}
      </Group>
      {blob && <Atlas image={blob} buffer={sprites} count={count} />}
    </>
  );
}

function Liquid(props: LiquidSceneProps) {
  const { word, time, melt, finish } = props;
  const scale = PixelRatio.get();
  const { fontSize } = word.data;
  return (
    <Group>
      {/* Pass 2: shade what pass 1 drew. */}
      <RuntimeShader
        source={CHROME_SOURCE}
        inputName="content"
        uniforms={{
          ...chromeUniforms(scale, fontSize, finish),
          uTime: time,
          uMelt: melt,
        }}
        sampleRadiusPx={Math.ceil(1.5 * scale) + 1}
      />
      <Group>
        {/* Pass 1: the height field — tube letters and sphere droplets,
            lightly blurred so they fillet where they meet. */}
        <Blur blur={softBlurPx(fontSize, scale)} />
        <HeightField {...props} />
      </Group>
    </Group>
  );
}

function bounceHex(finish: FinishName = 'iridescent'): string {
  const hex = (c: number) =>
    Math.round(Math.min(1, c) * 255)
      .toString(16)
      .padStart(2, '0');
  const [r, g, b] = FINISHES[finish].bounce;
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function LiquidScene(props: LiquidSceneProps) {
  const { width, height, floorY } = props.word.data;
  return (
    <>
      <Fill color="black" />
      {props.reflection !== false && (
        <>
          {/* The reflection is the bare height field, tinted and faint: the
              full blur-and-shade pipeline a second time halved the frame
              rate for a detail drawn at a fraction of the brightness. */}
          <Group
            transform={[{ translateY: 2 * floorY }, { scaleY: -1 }]}
            opacity={0.08}
          >
            <BlendColor color={bounceHex(props.finish)} mode="srcIn" />
            <HeightField {...props} />
          </Group>
          <Rect x={0} y={floorY} width={width} height={height - floorY}>
            <LinearGradient
              start={{ x: 0, y: floorY }}
              end={{ x: 0, y: floorY + (height - floorY) * 0.6 }}
              colors={['#00000000', '#000000ff']}
            />
          </Rect>
        </>
      )}
      <Liquid {...props} />
    </>
  );
}
