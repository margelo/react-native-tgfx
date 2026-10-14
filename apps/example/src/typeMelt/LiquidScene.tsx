import React from 'react';
import {
  Atlas,
  Blur,
  Circle,
  Fill,
  Group,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  RuntimeShader,
  type SpriteBuffer,
  type TgfxImage,
} from 'react-native-tgfx';
import { CHROME_SOURCE, CHROME_UNIFORMS } from './material';
import type { LetterValues, Value } from './sim';
import { BLOB } from './state';
import type { Word } from './word';

export interface LiquidSceneProps {
  word: Word;
  letters: LetterValues[];
  letterOpacity: Value | number;
  blob: TgfxImage | null;
  sprites: SpriteBuffer;
  count: Value | number;
  time: Value | number;
  reflection?: boolean;
}

/** The droplet texture: solid core, soft edge, so the blur has something to round off. */
export function BlobSprite() {
  const c = BLOB / 2;
  return (
    <Circle cx={c} cy={c} r={c}>
      <RadialGradient
        center={{ x: c, y: c }}
        r={c}
        colors={['#ffffffff', '#ffffffff', '#ffffff00']}
        positions={[0, 0.55, 1]}
      />
    </Circle>
  );
}

function Liquid({
  word,
  letters,
  letterOpacity,
  blob,
  sprites,
  count,
  time,
}: LiquidSceneProps) {
  return (
    <Group>
      {/* Pass 2: shade what pass 1 drew. */}
      <RuntimeShader
        source={CHROME_SOURCE}
        inputName="content"
        uniforms={{ ...CHROME_UNIFORMS, uTime: time }}
        sampleRadiusPx={4}
      />
      <Group>
        {/* Pass 1: plain white geometry, blurred into a height field. */}
        <Blur blur={word.data.fontSize * 0.06} />
        <Group opacity={letterOpacity}>
          {word.paths.map((path, i) => (
            <Group
              key={i}
              transform={[
                { translateX: letters[i]!.x },
                { translateY: letters[i]!.y },
                { rotate: letters[i]!.rot },
                { scaleY: letters[i]!.sy },
              ]}
            >
              <Path path={path} color="white" />
              <Path
                path={path}
                color="white"
                style="stroke"
                strokeWidth={word.strokeWidth}
                strokeJoin="round"
              />
            </Group>
          ))}
        </Group>
        {blob && <Atlas image={blob} buffer={sprites} count={count} />}
      </Group>
    </Group>
  );
}

export function LiquidScene(props: LiquidSceneProps) {
  const { width, height, floorY } = props.word.data;
  return (
    <>
      <Fill color="black" />
      {props.reflection !== false && (
        <>
          <Group
            transform={[{ translateY: 2 * floorY }, { scaleY: -1 }]}
            opacity={0.3}
          >
            <Liquid {...props} />
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
