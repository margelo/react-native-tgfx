// The scenes added on 2026-11-10: shapes animated one by one (declarative,
// imperative) and a static picture. Each engine binds them the
// fastest way its own API offers for that style:
//
//   anim-decl       5k shapes, two derived values each, bound as props.
//   anim-imp        5k shapes, one worklet per frame, no reconciler on the
//                   frame path: tgfx Scene + node handles on a raw native view;
//                   skia records an SkPicture into a shared value.
//   shapes-picture  the static 20k shapes recorded once and replayed under the
//                   rotation: tgfx <Group picture>; skia <Picture>.
import React, { useEffect, useMemo, useRef } from 'react';
import { PixelRatio, StyleSheet } from 'react-native';
import { callback } from 'react-native-nitro-modules';
import {
  useAnimatedReaction,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import {
  Circle as TgfxCircle,
  Group as TgfxGroup,
  Rect as TgfxRect,
  Scene,
  TgfxNativeView,
  circle,
  createHandle,
  fill,
  rect,
  type TgfxViewRef,
} from 'react-native-tgfx';
import {
  Circle as SkCircle,
  Group as SkGroup,
  Picture as SkPictureView,
  Rect as SkRect,
  Skia,
  vec,
  type SkPicture,
} from 'react-native-skia';

import {
  BG,
  CX,
  CY,
  H,
  IMP_CENTRES,
  IMP_CIRCLE,
  IMP_SHAPES,
  IMP_SIZE,
  IMP_WHICH,
  PALETTE,
  SHAPES,
  SHAPES_5K,
  W,
  orbitX,
  orbitY,
  type Shape,
} from './layout';

export const ANIM_SCENES = ['anim-decl', 'anim-imp', 'shapes-picture'] as const;
export type View = 'surface' | 'texture';
type T = SharedValue<number>;

const IMP_N = IMP_SHAPES.length;

// ---- tgfx -----------------------------------------------------------------

function TgfxDeclShape({ s, i, t }: { s: Shape; i: number; t: T }) {
  const cx = s.x + s.size / 2;
  const cy = s.y + s.size / 2;
  const off = s.circle ? 0 : s.size / 2;
  const x = useDerivedValue(() => cx - off + orbitX(i, t.value));
  const y = useDerivedValue(() => cy - off + orbitY(i, t.value));
  return s.circle ? (
    <TgfxCircle cx={x} cy={y} r={s.size / 2} color={s.color} />
  ) : (
    <TgfxRect x={x} y={y} width={s.size} height={s.size} color={s.color} />
  );
}

/** The tgfx scenes drawn inside a <Canvas>; anim-imp has its own view. */
export function TgfxAnimScene({ scene, t }: { scene: string; t: T }) {
  if (scene === 'anim-decl') {
    return (
      <>
        {SHAPES_5K.map((s, i) => (
          <TgfxDeclShape key={i} s={s} i={i} t={t} />
        ))}
      </>
    );
  }
  // shapes-picture
  return (
    <TgfxGroup transform={[{ rotate: t }]} origin={{ x: CX, y: CY }}>
      <TgfxGroup picture>
        {SHAPES.map((s, i) =>
          s.circle ? (
            <TgfxCircle key={i} cx={s.x + s.size / 2} cy={s.y + s.size / 2} r={s.size / 2} color={s.color} />
          ) : (
            <TgfxRect key={i} x={s.x} y={s.y} width={s.size} height={s.size} color={s.color} />
          )
        )}
      </TgfxGroup>
    </TgfxGroup>
  );
}

/**
 * anim-imp for tgfx: a Scene built from factories on a raw native view, so
 * React never sees the nodes, and one worklet per frame writing every
 * handle. `inHierarchy` is what `<Canvas composite="texture">` sets.
 */
export function TgfxImperativeView({
  t,
  view,
  driver,
  onAttached,
}: {
  t: T;
  view: View;
  driver: 'ui' | 'js';
  onAttached?: () => void;
}) {
  const built = useRef<{ scene: Scene; handles: ReturnType<typeof createHandle>[] } | null>(null);
  if (built.current == null) {
    const t0 = Date.now();
    const handles = IMP_SHAPES.map(() => createHandle());
    const t1 = Date.now();
    // Promote the animated keys to slots with one JS-side write per handle,
    // before the first compile. A worklet set() of a key that was never
    // written from JS is not patchable: it falls back to runOnJS + re-encode,
    // which at 20k handles per frame wedges the JS thread (package issue).
    IMP_SHAPES.forEach((s, i) =>
      handles[i].set(
        s.circle ? { cx: s.x + s.size / 2, cy: s.y + s.size / 2 } : { x: s.x, y: s.y }
      )
    );
    const scene = Scene.from([
      fill({ color: BG }),
      ...IMP_SHAPES.map((s, i) =>
        s.circle
          ? circle({ ref: handles[i], cx: s.x + s.size / 2, cy: s.y + s.size / 2, r: s.size / 2, color: s.color })
          : rect({ ref: handles[i], x: s.x, y: s.y, width: s.size, height: s.size, color: s.color })
      ),
    ]);
    built.current = { scene, handles };
    console.log(`[bench] anim-imp build handles=${(t1 - t0).toFixed(0)}ms scene=${(Date.now() - t1).toFixed(0)}ms`);
  }
  const { scene, handles } = built.current;
  const detach = useRef<(() => void) | null>(null);
  const attached = useRef(onAttached);
  attached.current = onAttached;
  const hybrid = useRef<ReturnType<typeof callback<(ref: TgfxViewRef) => void>> | null>(null);
  if (hybrid.current == null) {
    hybrid.current = callback((ref: TgfxViewRef) => {
      detach.current?.();
      detach.current = scene.attach(ref);
      attached.current?.();
    });
  }
  useEffect(
    () => () => {
      detach.current?.();
      scene.dispose();
    },
    [scene]
  );
  const home = IMP_CENTRES;
  const isCircle = IMP_CIRCLE;
  const half = IMP_SIZE / 2;
  // driver=ui: one worklet on the UI thread writes every handle (mounted only
  // then: a worklet serializes all it captures). driver=js: a
  // requestAnimationFrame loop on the JS thread does.
  useEffect(() => {
    if (driver !== 'js') return;
    let alive = true;
    let frames = 0;
    let spent = 0;
    const loop = () => {
      if (!alive) return;
      const start = Date.now();
      const tv = t.value;
      for (let i = 0; i < IMP_N; i++) {
        const x = home[i * 2] + orbitX(i, tv);
        const y = home[i * 2 + 1] + orbitY(i, tv);
        if (isCircle[i]) {
          handles[i].set({ cx: x, cy: y });
        } else {
          handles[i].set({ x: x - half, y: y - half });
        }
      }
      spent += Date.now() - start;
      if (++frames % 120 === 0) {
        console.log(`[bench] anim-imp js set ms/frame=${(spent / 120).toFixed(1)}`);
        spent = 0;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => {
      alive = false;
    };
  }, [driver, t, handles, home, isCircle, half]);
  return (
    <>
      {driver === 'ui' ? <TgfxUiDriver t={t} handles={handles} /> : null}
      <TgfxNativeView
      inHierarchy={view === 'texture'}
      opaque
      style={StyleSheet.absoluteFill}
      hybridRef={hybrid.current}
      />
    </>
  );
}

function TgfxUiDriver({ t, handles }: { t: T; handles: ReturnType<typeof createHandle>[] }) {
  const home = IMP_CENTRES;
  const isCircle = IMP_CIRCLE;
  const half = IMP_SIZE / 2;
  useEffect(() => {
    const t0 = Date.now();
    // Measures nothing by itself; the log orders the build against the first frames.
    console.log(`[bench] anim-imp ui driver mounted at ${t0.toFixed(0)}`);
  }, []);
  useAnimatedReaction(
    () => t.value,
    tv => {
      for (let i = 0; i < IMP_N; i++) {
        const x = home[i * 2] + orbitX(i, tv);
        const y = home[i * 2 + 1] + orbitY(i, tv);
        if (isCircle[i]) {
          handles[i].set({ cx: x, cy: y });
        } else {
          handles[i].set({ x: x - half, y: y - half });
        }
      }
    },
    []
  );
  return null;
}

// ---- skia -----------------------------------------------------------------

function useSkPaints() {
  return useMemo(
    () =>
      PALETTE.map(c => {
        const p = Skia.Paint();
        p.setColor(Skia.Color(c));
        p.setAntiAlias(true);
        return p;
      }),
    []
  );
}

function SkDeclShape({ s, i, t }: { s: Shape; i: number; t: T }) {
  const cx = s.x + s.size / 2;
  const cy = s.y + s.size / 2;
  const off = s.circle ? 0 : s.size / 2;
  const x = useDerivedValue(() => cx - off + orbitX(i, t.value));
  const y = useDerivedValue(() => cy - off + orbitY(i, t.value));
  return s.circle ? (
    <SkCircle cx={x} cy={y} r={s.size / 2} color={s.color} />
  ) : (
    <SkRect x={x} y={y} width={s.size} height={s.size} color={s.color} />
  );
}

/** anim-imp for skia: the UI-thread worklet records all 5k draws per frame. */
function SkImperative({ t }: { t: T }) {
  const paints = useSkPaints();
  const home = IMP_CENTRES;
  const isCircle = IMP_CIRCLE;
  const which = IMP_WHICH;
  const size = IMP_SIZE;
  const half = IMP_SIZE / 2;
  const bounds = Skia.XYWHRect(0, 0, W, H);
  const picture = useDerivedValue(() => {
    const tv = t.value;
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(bounds);
    for (let i = 0; i < IMP_N; i++) {
      const x = home[i * 2] + orbitX(i, tv);
      const y = home[i * 2 + 1] + orbitY(i, tv);
      const paint = paints[which[i]];
      if (isCircle[i]) {
        canvas.drawCircle(x, y, half, paint);
      } else {
        canvas.drawRect({ x: x - half, y: y - half, width: size, height: size }, paint);
      }
    }
    return recorder.finishRecordingAsPicture();
  });
  return <SkPictureView picture={picture} />;
}

/**
 * The static `shapes` scene for skia: one ShapeBlob (3.10's batched shape API,
 * the explicit form of the batching tgfx does internally), recorded once and
 * replayed under the rotation as a single drawShapes.
 */
export function SkBlobShapes({ t }: { t: T }) {
  const picture = useMemo(() => {
    // A picture recorder has no device scale; rasterize at the canvas's.
    const blob = Skia.ShapeBlob({ rasterScale: PixelRatio.get() });
    for (const s of SHAPES) {
      if (s.circle) {
        blob.addCircle(s.x + s.size / 2, s.y + s.size / 2, s.size / 2, Skia.Color(s.color));
      } else {
        blob.addRect({ x: s.x, y: s.y, width: s.size, height: s.size }, Skia.Color(s.color));
      }
    }
    const recorder = Skia.PictureRecorder();
    recorder.beginRecording(Skia.XYWHRect(0, 0, W, H)).drawShapes(blob);
    return recorder.finishRecordingAsPicture();
  }, []);
  const transform = useDerivedValue(() => [{ rotate: t.value }]);
  return (
    <SkGroup transform={transform} origin={vec(CX, CY)}>
      <SkPictureView picture={picture} />
    </SkGroup>
  );
}

function useStaticSkPicture(): SkPicture {
  const paints = useSkPaints();
  return useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, W, H));
    for (const s of SHAPES) {
      if (s.circle) {
        canvas.drawCircle(s.x + s.size / 2, s.y + s.size / 2, s.size / 2, paints[s.which]);
      } else {
        canvas.drawRect({ x: s.x, y: s.y, width: s.size, height: s.size }, paints[s.which]);
      }
    }
    return recorder.finishRecordingAsPicture();
  }, [paints]);
}

function SkStaticPicture({ t }: { t: T }) {
  const picture = useStaticSkPicture();
  const transform = useDerivedValue(() => [{ rotate: t.value }]);
  return (
    <SkGroup transform={transform} origin={vec(CX, CY)}>
      <SkPictureView picture={picture} />
    </SkGroup>
  );
}

export function SkiaAnimScene({ scene, t }: { scene: string; t: T }) {
  if (scene === 'anim-decl') {
    return (
      <>
        {SHAPES_5K.map((s, i) => (
          <SkDeclShape key={i} s={s} i={i} t={t} />
        ))}
      </>
    );
  }
  if (scene === 'anim-imp') return <SkImperative t={t} />;
  return <SkStaticPicture t={t} />;
}
