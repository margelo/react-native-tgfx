// tgfx vs react-native-skia 3 (Graphite on Vulkan), one scene at a time. The app runs the
// whole matrix by itself and prints one `[bench] tick ...` line per second to
// logcat; bench/run.mjs pairs those with host-side CPU and PSS samples.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, Text as RNText, View } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  Canvas as TgfxCanvas,
  Circle as TgfxCircle,
  Fill as TgfxFill,
  Group as TgfxGroup,
  ImageShader as TgfxImageShader,
  Path as TgfxPath,
  Rect as TgfxRect,
  Shader as TgfxShader,
  Text as TgfxText,
  TgfxImage,
  renderToImage,
} from 'react-native-tgfx';
import {
  Canvas as SkCanvas,
  Fill as SkFill,
  Group as SkGroup,
  Image as SkImageView,
  ImageShader as SkImageShader,
  Path as SkPath,
  Rect as SkRect,
  Shader as SkShader,
  Text as SkText,
  TextBlob as SkTextBlobView,
  Skia,
  matchFont,
  vec,
  type SkImage,
} from 'react-native-skia';

import { ANIM_SCENES, SkBlobShapes, SkiaAnimScene, TgfxAnimScene, TgfxImperativeView, type View as BackingView } from './AnimScenes';
import { BG, CX, CY, H, PALETTE, SHAPES, W } from './layout';

// react-native-skia 3.x has one canvas, on Graphite.
const ENGINES = ['tgfx', 'skia'] as const;
const SCENES = ['shapes', 'images', 'shader', 'pattern', 'paths', 'text', ...ANIM_SCENES] as const;
// surface: tgfx composite="layer", skia backingView SurfaceView.
// texture: tgfx composite="texture", skia backingView TextureView (its default).
const VIEWS = ['surface', 'texture'] as const;
const COMBO_MS = 28_000; // 3s settle + 20s measured (run.mjs trims the settle)
type Engine = (typeof ENGINES)[number];
type Combo = [Engine, string, BackingView];

// Launch URL picks the matrix: bench://run?engines=skia,tgfx&scenes=paths&views=surface,texture&order=alternate&reps=2&gap=30
// order=sequential runs every scene per engine; alternate runs both engines per scene.
// Views are the outer loop: the whole matrix on one view, then on the next.
// gap=<seconds> idles with no canvas mounted between combos, so the phone cools the same
// amount before every engine.
function buildPlan(url: string | null): Combo[] {
  // RN's URLSearchParams has no get(), so split by hand.
  const q = new Map(
    (url?.split('?')[1] ?? '').split('&').map(kv => kv.split('=') as [string, string])
  );
  const pick = (key: string, all: readonly string[]) => {
    const chosen = (q.get(key) ?? '')
      .split(',')
      .filter(v => all.includes(v) || (key === 'scenes' && /^paths\d+$/.test(v)));
    return chosen.length ? chosen : [...all];
  };
  const engines = pick('engines', ENGINES) as Engine[];
  const scenes = pick('scenes', SCENES);
  const views = pick('views', VIEWS) as BackingView[];
  const reps = Math.max(1, Number(q.get('reps') ?? 1) || 1);
  // skip=tgfx:anim-imp,skia:text drops engine:scene pairs from every view.
  const skip = new Set((q.get('skip') ?? '').split(',').filter(Boolean));
  const keep = (c: Combo) => !skip.has(`${c[0]}:${c[1]}`);
  const one: Combo[] = views.flatMap(v =>
    q.get('order') === 'alternate'
      ? scenes.flatMap(s => engines.map(e => [e, s, v] as Combo))
      : engines.flatMap(e => scenes.map(s => [e, s, v] as Combo))
  ).filter(keep);
  return Array.from({ length: reps }, () => one).flat();
}

function gapMsFrom(url: string | null): number {
  const gap = Number(url?.match(/[?&]gap=(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  return Number.isFinite(gap) ? gap * 1000 : 0;
}

// ---- static scene layouts (identical for both engines) ---------------------

const IMAGE_CELLS = Array.from({ length: 3600 }, (_, i) => ({
  x: (i % 60) * (W / 60),
  y: Math.floor(i / 60) * (H / 60),
  size: W / 60 - 1,
  which: i % 8,
}));

// Cubic squiggles on a grid, half filled and half stroked. Identical geometry for
// both engines: the same `d` strings go to each engine's Path component.
function makePaths(count: number, cols: number) {
  return Array.from({ length: count }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * (W / cols);
    const y = row * (H / cols);
    const w = W / cols - 1;
    const h = H / cols - 1;
    return {
      d:
        `M${x} ${y + h / 2}` +
        `C${x + w / 4} ${y}, ${x + w / 2} ${y + h}, ${x + w} ${y + h / 2}` +
        `C${x + w * 0.75} ${y + h}, ${x + w / 2} ${y}, ${x} ${y + h / 2}Z`,
      color: PALETTE[i % PALETTE.length],
      stroked: i % 2 === 0,
    };
  });
}
// `paths` is PATHS_DEFAULT paths; `paths<N>` (paths900, paths10000, ...) is any
// other count, on the smallest square grid that holds it.
const PATHS_DEFAULT = 10000;
const pathsCache = new Map<number, ReturnType<typeof makePaths>>();
function pathsFor(scene: string) {
  const count = Number(scene.slice('paths'.length)) || PATHS_DEFAULT;
  let paths = pathsCache.get(count);
  if (paths == null) {
    paths = makePaths(count, Math.ceil(Math.sqrt(count)));
    pathsCache.set(count, paths);
  }
  return paths;
}

const TEXTS = Array.from({ length: 6000 }, (_, i) => ({
  x: (i % 25) * (W / 25),
  y: 8 + Math.floor(i / 25) * ((H - 16) / 240),
  label: `bench ${i}`,
  color: PALETTE[i % PALETTE.length],
}));

const SKSL = `
uniform float uTime;
uniform float2 uSize;
half4 main(float2 pos) {
  float2 uv = pos / uSize;
  float v = 0.0;
  float2 c = uv - 0.5;
  for (int i = 1; i <= 40; i++) {
    float f = float(i);
    v += sin((uv.x * 9.0 + uTime) * f) * 0.5 / f;
    v += sin((uv.y * 11.0 - uTime) * f) * 0.5 / f;
    v += sin(sqrt(dot(c, c)) * (18.0 + 3.0 * f) - uTime * 2.0) / f;
  }
  v *= 0.22;
  return half4(0.5 + 0.5 * sin(6.28 * v),
               0.5 + 0.5 * sin(6.28 * v + 2.1),
               0.5 + 0.5 * sin(6.28 * v + 4.2), 1.0);
}`;

const skEffect = Skia.RuntimeEffect.Make(SKSL)!;
const skFont = matchFont({ fontFamily: 'sans-serif', fontSize: 14 });
let skBlobs: ReturnType<typeof Skia.TextBlob.MakeFromText>[] | null = null;
const skTextBlobs = () => (skBlobs ??= TEXTS.map(item => Skia.TextBlob.MakeFromText(item.label, skFont)));

// ---- per-engine image assets ----------------------------------------------

function makeSkTexture(i: number, size: number): SkImage {
  // A raster surface: its snapshot is a CPU image every canvas can draw (a GPU
  // snapshot cannot cross into the on-screen context). 3.10 dropped the sync
  // GPU-to-raster readback the bench used before.
  const surface = Skia.Surface.MakeRaster(size, size)!;
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(PALETTE[i % PALETTE.length]));
  canvas.drawRect({ x: 0, y: 0, width: size, height: size }, paint);
  paint.setColor(Skia.Color(PALETTE[(i + 3) % PALETTE.length]));
  canvas.drawCircle(size / 2, size / 2, size / 3, paint);
  paint.setColor(Skia.Color('#00000040'));
  canvas.drawRect({ x: size / 4, y: size / 4, width: size / 2, height: 6 }, paint);
  return surface.makeImageSnapshot();
}

function tgfxTextureScene(i: number, size: number) {
  return (
    <>
      <TgfxFill color={PALETTE[i % PALETTE.length]} />
      <TgfxCircle
        cx={size / 2}
        cy={size / 2}
        r={size / 3}
        color={PALETTE[(i + 3) % PALETTE.length]}
      />
      <TgfxRect x={size / 4} y={size / 4} width={size / 2} height={6} color="#00000040" />
    </>
  );
}

// ---- scenes ----------------------------------------------------------------

function TgfxScene({
  scene,
  t,
  images,
  tile,
}: {
  scene: string;
  t: ReturnType<typeof useSharedValue<number>>;
  images: TgfxImage[];
  tile: TgfxImage | null;
}) {
  const origin = { x: CX, y: CY };
  if (scene === 'shapes') {
    return (
      <TgfxGroup transform={[{ rotate: t }]} origin={origin}>
        {SHAPES.map((s, i) =>
          s.circle ? (
            <TgfxCircle key={i} cx={s.x + s.size / 2} cy={s.y + s.size / 2} r={s.size / 2} color={s.color} />
          ) : (
            <TgfxRect key={i} x={s.x} y={s.y} width={s.size} height={s.size} color={s.color} />
          )
        )}
      </TgfxGroup>
    );
  }
  if (scene === 'images') {
    if (images.length < 8) return null;
    return (
      <TgfxGroup transform={[{ rotate: t }]} origin={origin}>
        {IMAGE_CELLS.map((c, i) => (
          <TgfxImage key={i} image={images[c.which]} x={c.x} y={c.y} width={c.size} height={c.size} />
        ))}
      </TgfxGroup>
    );
  }
  if (scene === 'shader') {
    return (
      <TgfxFill>
        <TgfxShader source={SKSL} uniforms={{ uTime: t, uSize: [W, H] }} />
      </TgfxFill>
    );
  }
  if (scene.startsWith('paths')) {
    return (
      <TgfxGroup transform={[{ rotate: t }]} origin={origin}>
        {pathsFor(scene).map((p, i) =>
          p.stroked ? (
            <TgfxPath key={i} path={p.d} color={p.color} style="stroke" strokeWidth={2} />
          ) : (
            <TgfxPath key={i} path={p.d} color={p.color} />
          )
        )}
      </TgfxGroup>
    );
  }
  if (scene === 'pattern') {
    if (tile == null) return null;
    return (
      <TgfxGroup transform={[{ rotate: t }, { scale: 0.03 }]} origin={origin}>
        <TgfxRect x={-W * 20} y={-H * 20} width={W * 41} height={H * 41}>
          <TgfxImageShader image={tile} tx="repeat" ty="repeat" />
        </TgfxRect>
      </TgfxGroup>
    );
  }
  return (
    <TgfxGroup transform={[{ rotate: t }]} origin={origin}>
      {TEXTS.map((item, i) => (
        <TgfxText key={i} x={item.x} y={item.y} text={item.label} fontSize={14} color={item.color} />
      ))}
    </TgfxGroup>
  );
}

function SkiaScene({
  scene,
  t,
  images,
  tile,
  skText,
}: {
  scene: string;
  t: ReturnType<typeof useSharedValue<number>>;
  images: SkImage[];
  tile: SkImage | null;
  skText: 'text' | 'blob';
}) {
  const transform = useDerivedValue(() => [{ rotate: t.value }]);
  const patternTransform = useDerivedValue(() => [{ rotate: t.value }, { scale: 0.03 }]);
  const uniforms = useDerivedValue(() => ({ uTime: t.value, uSize: [W, H] }));
  const origin = vec(CX, CY);
  if (scene === 'images') {
    if (images.length < 8) return null;
    return (
      <SkGroup transform={transform} origin={origin}>
        {IMAGE_CELLS.map((c, i) => (
          <SkImageView key={i} image={images[c.which]} x={c.x} y={c.y} width={c.size} height={c.size} />
        ))}
      </SkGroup>
    );
  }
  if (scene === 'shader') {
    return (
      <SkFill>
        <SkShader source={skEffect} uniforms={uniforms} />
      </SkFill>
    );
  }
  if (scene.startsWith('paths')) {
    return (
      <SkGroup transform={transform} origin={origin}>
        {pathsFor(scene).map((p, i) =>
          p.stroked ? (
            <SkPath key={i} path={p.d} color={p.color} style="stroke" strokeWidth={2} />
          ) : (
            <SkPath key={i} path={p.d} color={p.color} />
          )
        )}
      </SkGroup>
    );
  }
  if (scene === 'pattern') {
    if (tile == null) return null;
    return (
      <SkGroup transform={patternTransform} origin={origin}>
        <SkRect x={-W * 20} y={-H * 20} width={W * 41} height={H * 41}>
          <SkImageShader image={tile} tx="repeat" ty="repeat" />
        </SkRect>
      </SkGroup>
    );
  }
  // sktext=blob: the same labels as prebuilt SkTextBlobs. <Text> hands Skia a
  // string per draw (drawSimpleText), which re-shapes it and rebuilds its GPU
  // blob every frame; a blob has an identity Skia's text cache can key on.
  if (skText === 'blob') {
    return (
      <SkGroup transform={transform} origin={origin}>
        {TEXTS.map((item, i) => (
          <SkTextBlobView key={i} x={item.x} y={item.y} blob={skTextBlobs()[i]} color={item.color} />
        ))}
      </SkGroup>
    );
  }
  return (
    <SkGroup transform={transform} origin={origin}>
      {TEXTS.map((item, i) => (
        <SkText key={i} x={item.x} y={item.y} text={item.label} font={skFont} color={item.color} />
      ))}
    </SkGroup>
  );
}

// ---- the bench -------------------------------------------------------------

export default function App() {
  const [combo, setCombo] = useState(0);
  const [tgfxImages, setTgfxImages] = useState<TgfxImage[]>([]);
  const [tgfxTile, setTgfxTile] = useState<TgfxImage | null>(null);
  const [plan, setPlan] = useState<Combo[] | null>(null);
  const [gapMs, setGapMs] = useState(0);
  // anim-imp for tgfx: which thread writes the 20k handles (bench://run?...&imp=js).
  const [impDriver, setImpDriver] = useState<'ui' | 'js'>('ui');
  // skia text: deviceIndependentFonts, on unless bench://run?...&dif=off.
  const [dif, setDif] = useState(true);
  // skia text: <Text> per label, or <TextBlob> with prebuilt blobs (&sktext=blob).
  const [skText, setSkText] = useState<'text' | 'blob'>('text');
  const [cooling, setCooling] = useState(false);
  useEffect(() => {
    Linking.getInitialURL().then(url => {
      setGapMs(gapMsFrom(url));
      setImpDriver(/[?&]imp=js\b/.test(url ?? '') ? 'js' : 'ui');
      setDif(!/[?&]dif=off\b/.test(url ?? ''));
      setSkText(/[?&]sktext=blob\b/.test(url ?? '') ? 'blob' : 'text');
      setPlan(buildPlan(url));
    });
  }, []);
  const done = plan != null && combo >= plan.length;
  const engine = plan == null || done ? 'done' : plan[combo][0];
  const scene = plan == null || done ? '' : plan[combo][1];
  const view: BackingView = plan == null || done ? 'surface' : plan[combo][2];

  const t = useSharedValue(0);
  const uiFrames = useSharedValue(0);
  const jsFrames = useRef(0);

  const skImages = useMemo(() => Array.from({ length: 8 }, (_, i) => makeSkTexture(i, 128)), []);
  const skTile = useMemo(() => makeSkTexture(2, 64), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const built: TgfxImage[] = [];
      for (let i = 0; i < 8; i += 1) {
        built.push(await renderToImage(tgfxTextureScene(i, 128), { width: 128, height: 128 }));
      }
      const builtTile = await renderToImage(tgfxTextureScene(2, 64), { width: 64, height: 64 });
      if (!alive) return;
      setTgfxImages(built);
      setTgfxTile(builtTile);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Each combo opens with t frozen at 0: the runner screencaps both engines in
  // the same pose (parity stills), then the rotation starts.
  useEffect(() => {
    if (done) return;
    cancelAnimation(t);
    t.value = 0;
    const poseTimer = setTimeout(
      () => console.log(`[bench] pose engine=${engine} scene=${scene} view=${view}`),
      2500
    );
    const animTimer = setTimeout(() => {
      t.value = withRepeat(
        withTiming(Math.PI * 2, { duration: 4000, easing: Easing.linear }),
        -1,
        false
      );
    }, 3500);
    return () => {
      clearTimeout(poseTimer);
      clearTimeout(animTimer);
      cancelAnimation(t);
    };
  }, [combo, done, engine, scene, view, t]);

  // UI-thread frames: a Reanimated frame callback rides the UI vsync.
  useFrameCallback(() => {
    'worklet';
    uiFrames.value = uiFrames.value + 1;
  }, true);

  // JS-thread frames.
  useEffect(() => {
    let alive = true;
    const loop = () => {
      jsFrames.current += 1;
      if (alive) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => {
      alive = false;
    };
  }, []);

  // One tick line per second; run.mjs joins these with CPU/PSS samples. None while
  // cooling: those seconds belong to no combo.
  useEffect(() => {
    if (done || cooling) return;
    const timer = setInterval(() => {
      console.log(`[bench] tick engine=${engine} scene=${scene} view=${view} js=${jsFrames.current} ui=${uiFrames.value}`);
      jsFrames.current = 0;
      uiFrames.value = 0;
    }, 1000);
    return () => clearInterval(timer);
  }, [engine, scene, view, done, cooling, uiFrames]);

  // The matrix driver. Waits for the tgfx assets before combo 0 starts.
  const ready = tgfxImages.length === 8 && tgfxTile != null && plan != null;
  const last = plan != null && combo >= plan.length - 1;
  useEffect(() => {
    if (!ready || done || cooling) return;
    console.log(`[bench] start engine=${engine} scene=${scene} view=${view}`);
    const timer = setTimeout(
      () => (gapMs > 0 && !last ? setCooling(true) : setCombo(c => c + 1)),
      COMBO_MS
    );
    return () => clearTimeout(timer);
  }, [ready, combo, done, cooling, gapMs, last, engine, scene, view]);

  // The gap: the canvas unmounts and the phone idles, the same for every engine.
  useEffect(() => {
    if (!cooling) return;
    console.log(`[bench] cool ms=${gapMs}`);
    const timer = setTimeout(() => {
      setCombo(c => c + 1);
      setCooling(false);
    }, gapMs);
    return () => clearTimeout(timer);
  }, [cooling, gapMs]);

  useEffect(() => {
    if (done) console.log('[bench] done');
  }, [done]);

  if (!ready) return <View style={styles.root} />;
  if (cooling) {
    return (
      <View style={styles.root}>
        <RNText style={styles.label}>cooling</RNText>
      </View>
    );
  }
  if (done) {
    return (
      <View style={styles.root}>
        <RNText style={styles.label}>bench done</RNText>
      </View>
    );
  }
  return (
    <View style={styles.root}>
      {engine === 'tgfx' ? (
        scene === 'anim-imp' ? (
          <TgfxImperativeView key={combo} t={t} view={view} driver={impDriver} />
        ) : (
          <TgfxCanvas
            key={combo}
            style={StyleSheet.absoluteFill}
            opaque
            composite={view === 'texture' ? 'texture' : 'layer'}
          >
            <TgfxFill color={BG} />
            {isAnim(scene) ? (
              <TgfxAnimScene scene={scene} t={t} />
            ) : (
              <TgfxScene scene={scene} t={t} images={tgfxImages} tile={tgfxTile} />
            )}
          </TgfxCanvas>
        )
      ) : (
        <SkCanvas
          key={combo}
          style={StyleSheet.absoluteFill}
          android={SK_ANDROID[view]}
          // Distance-field glyphs: rasterized once and reused under the rotation,
          // instead of re-rasterized for every new transform (3.10, off by default).
          deviceIndependentFonts={scene === 'text' && dif}
        >
          <SkFill color={BG} />
          {scene === 'shapes' ? (
            <SkBlobShapes t={t} />
          ) : isAnim(scene) ? (
            <SkiaAnimScene scene={scene} t={t} />
          ) : (
            <SkiaScene scene={scene} t={t} images={skImages} tile={skTile} skText={skText} />
          )}
        </SkCanvas>
      )}
      <RNText style={styles.label}>{`${engine} · ${scene} · ${view}`}</RNText>
    </View>
  );
}

// Each view runs both engines on the same kind of layer: an opaque SurfaceView
// (tgfx composite="layer", its default) or a TextureView in the view hierarchy
// (tgfx composite="texture"; skia's default since 3.8).
const SK_ANDROID = {
  surface: { backingView: 'SurfaceView', opaque: true },
  texture: { backingView: 'TextureView', opaque: true },
} as const;
const isAnim = (scene: string) => (ANIM_SCENES as readonly string[]).includes(scene);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101014' },
  label: {
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
    color: '#ffffff88',
    fontSize: 12,
  },
});
