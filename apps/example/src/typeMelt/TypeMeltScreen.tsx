import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  makeMutable,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import {
  Canvas,
  SPRITE_FLOATS,
  spriteFloats,
  useClock,
  useFonts,
  useOffscreenImage,
  useSpriteBuffer,
} from 'react-native-tgfx';
import { buildHeightImages, type HeightImage } from './heightImages';
import { softBlurPx } from './material';
import { BlobSprite, LiquidScene } from './LiquidScene';
import {
  destroy,
  publish,
  rebuild,
  setMode,
  step,
  type LetterValues,
} from './sim';
import {
  BLOB,
  CAP,
  LETTERS,
  MODE_EXPLODE,
  MODE_FALL,
  MODE_MELT,
  createState,
  type SimState,
} from './state';
import { FAMILY, FONT_FILES, buildWord } from './word';

const MODES = [
  { mode: MODE_MELT, label: 'Melt' },
  { mode: MODE_EXPLODE, label: 'Explode' },
  { mode: MODE_FALL, label: 'Fall' },
];

// The sim lives on the UI runtime, not in a worklet closure: closures are
// re-serialised when the component re-renders, which would fork the state.
type Holder = { __typeMelt?: SimState };

function stateOf(): SimState | undefined {
  'worklet';
  return (globalThis as Holder).__typeMelt;
}

export function TypeMeltScreen() {
  const fontsReady = useFonts({ [FAMILY]: FONT_FILES });
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [mode, setModeState] = useState(MODE_MELT);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const word = useMemo(
    () =>
      fontsReady && size.width > 0 ? buildWord(size.width, size.height) : null,
    [fontsReady, size],
  );

  const [letters] = useState<LetterValues[]>(() =>
    Array.from({ length: LETTERS }, () => ({
      x: makeMutable(0),
      y: makeMutable(0),
      rot: makeMutable(0),
      sx: makeMutable(1),
      sy: makeMutable(1),
    })),
  );
  const letterOpacity = useSharedValue(1);
  const count = useSharedValue(0);
  const melt = useSharedValue(0);
  const fontSize = word?.data.fontSize ?? 0;
  const scale = PixelRatio.get();
  const blur = useDerivedValue(() => softBlurPx(fontSize, scale, melt.value));
  const sprites = useSpriteBuffer(CAP);
  const time = useClock();
  const blob = useOffscreenImage(
    <BlobSprite />,
    { width: BLOB, height: BLOB, pixelRatio: 1 },
    [],
  );

  // Every sprite samples the whole blob texture; only scale and centre move per frame.
  // The tube height images, rebuilt with the word; the old ones are freed.
  const [heights, setHeights] = useState<HeightImage[] | null>(null);
  useEffect(() => {
    if (!word) {
      return;
    }
    let live = true;
    let built: HeightImage[] = [];
    buildHeightImages(word, PixelRatio.get())
      .then(images => {
        built = images;
        if (live) {
          setHeights(images);
        } else {
          images.forEach(h => h.image.dispose());
        }
      })
      .catch(error => {
        // Without heights the letters can't draw; say why instead of failing silently.
        console.error('[TypeMelt] building letter height images failed', error);
      });
    return () => {
      live = false;
      built.forEach(h => h.image.dispose());
      setHeights(null);
    };
  }, [word]);

  useEffect(() => {
    for (let i = 0; i < CAP; i++) {
      sprites.data[i * SPRITE_FLOATS + 2] = BLOB;
      sprites.data[i * SPRITE_FLOATS + 3] = BLOB;
    }
  }, [sprites]);

  // A new size means a new word: replace the sim wholesale, intact, in the current mode.
  useEffect(() => {
    if (!word) {
      return;
    }
    const data = word.data;
    const start = modeRef.current;
    scheduleOnUI(() => {
      'worklet';
      (globalThis as Holder).__typeMelt = createState(data, start);
    });
    return () => {
      scheduleOnUI(() => {
        'worklet';
        delete (globalThis as Holder).__typeMelt;
      });
    };
  }, [word]);

  useFrameCallback(frame => {
    'worklet';
    const s = stateOf();
    if (!s) {
      return;
    }
    step(s, (frame.timeSincePreviousFrame ?? 16) / 1000);
    publish(
      s,
      spriteFloats(sprites),
      letters,
      letterOpacity,
      count,
      melt,
      frame.timestamp,
    );
  });

  const pan = Gesture.Pan()
    .minDistance(12)
    .onEnd(e => {
      'worklet';
      const s = stateOf();
      if (!s) {
        return;
      }
      destroy(s, {
        sx: e.x - e.translationX,
        sy: e.y - e.translationY,
        ex: e.x,
        ey: e.y,
        speed: Math.min(4000, Math.hypot(e.velocityX, e.velocityY)),
      });
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      'worklet';
      const s = stateOf();
      if (s) {
        rebuild(s);
      }
    });
  const gesture = Gesture.Exclusive(doubleTap, pan);

  const choose = (next: number) => {
    setModeState(next);
    scheduleOnUI((m: number) => {
      'worklet';
      const s = stateOf();
      if (s) {
        setMode(s, m);
      }
    }, next);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.modes, { marginTop: insets.top + 8 }]}>
        {MODES.map(m => (
          <Pressable
            key={m.label}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === m.mode }}
            onPress={() => choose(m.mode)}
            style={[styles.mode, mode === m.mode && styles.modeOn]}
          >
            <Text
              style={[styles.modeText, mode === m.mode && styles.modeTextOn]}
            >
              {m.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.stage}
          testID="typemelt-stage"
          onLayout={e => {
            const { width, height } = e.nativeEvent.layout;
            setSize(prev =>
              prev.width === width && prev.height === height
                ? prev
                : { width, height },
            );
          }}
        >
          {word && (
            <Canvas style={StyleSheet.absoluteFill}>
              <LiquidScene
                word={word}
                heights={heights}
                letters={letters}
                letterOpacity={letterOpacity}
                blob={blob}
                sprites={sprites}
                count={count}
                time={time}
                blur={blur}
              />
            </Canvas>
          )}
        </View>
      </GestureDetector>
      <Text style={styles.hint}>Swipe to destroy · double-tap to rebuild</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
  modes: { flexDirection: 'row', alignSelf: 'center', gap: 8 },
  mode: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#555',
  },
  modeOn: { backgroundColor: '#f2f2f2', borderColor: '#f2f2f2' },
  modeText: { color: '#aaa', fontSize: 14 },
  modeTextOn: { color: 'black' },
  stage: { flex: 1 },
  hint: { color: '#666', textAlign: 'center', fontSize: 12, marginBottom: 8 },
});
