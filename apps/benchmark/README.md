# TgfxSkiaBench

react-native-tgfx vs `react-native-skia` 3.10.0 (Graphite on Vulkan), one scene at a
time, on a release build. Two engines: `tgfx` and `skia`; since 3.8 skia has a single
`Canvas`, on Graphite (3.0's separate `GraphiteCanvas` is gone). The app runs a scene matrix by itself and prints one
`[bench] tick engine=… scene=… js=… ui=…` line per second to logcat;
`bench/run.mjs` on the host pairs those with CPU (`/proc/<pid>/stat`), PSS
(`dumpsys meminfo`) and the presented frame rate (SurfaceFlinger), and writes a
table to `bench/results-<timestamp>.md`.

Static scenes: 20,000 shapes, 3,600 images, a 40-octave full-screen shader, a
repeating image pattern, 10,000 cubic paths (half stroked) and 6,000 texts, each
under one animated rotation driven by a shared value. `paths<N>` runs any other
path count (`paths900` is the scene the tables before 2026-11-10 used; both
engines sit at 120 fps on it on a current flagship). The default matrix runs
`paths900`, `paths2500`, `paths5000` and `paths` (10,000), so a table shows
where each engine falls off.

Skia draws the static shapes through `Skia.ShapeBlob` + `drawShapes` (3.10),
recorded once into a picture: its explicit batched-shape API, the counterpart of
the batching tgfx does internally for plain `<Rect>`/`<Circle>` nodes. The
unbatched Skia path is the `shapes-picture` row. Two more rows hold the
technique equal:

| scene | tgfx | skia |
|---|---|---|
| `shapes` | 20,000 `<Rect>`/`<Circle>` nodes | one ShapeBlob |
| `shapes-nodes` | 20,000 `<Rect>`/`<Circle>` nodes | 20,000 `<Rect>`/`<Circle>` nodes |
| `shapes-atlas` | a white circle and rect rasterized once into an atlas, 20,000 tinted quads in one `<Vertices>` | one ShapeBlob (the same technique, built in) |

Per-shape scenes (`AnimScenes.tsx`): every shape orbits its own home on its own
phase and speed, so no transform can be shared and tgfx's draw reordering
(which needs literal bounds) switches itself off. Each engine binds them the
fastest way its API offers for that style:

| scene | shapes | tgfx | skia |
|---|---|---|---|
| `anim-decl` | 5,000 | two `useDerivedValue` per shape, bound as props | the same |
| `anim-imp` | 5,000 | `Scene` + node handles on a raw `TgfxNativeView`, one worklet writes every handle; the 5,000 handles take a few seconds to create, so the combo's clock starts once the scene is attached | one worklet records an `SkPicture` per frame into `<Picture>` |
| `shapes-picture` | 20,000 | the static shapes in `<Group picture>` under the rotation | the static shapes recorded once, `<Picture>` under the rotation |

`anim-decl` stops at 5,000: at 20,000 the 40,000 mappers measure Reanimated,
not the engines.

Every scene runs on both Android view kinds (`views`): `surface` (tgfx
`composite="layer"`, skia `backingView: 'SurfaceView'`) and `texture` (tgfx
`composite="texture"`, skia `backingView: 'TextureView'`).

## Run

```sh
bun install                                   # from the repo root
cd apps/benchmark/android
ANDROID_HOME=$HOME/Library/Android/sdk ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
cd .. && ANDROID_SERIAL=<serial> node bench/run.mjs
```

Benchmark **release** builds only — a debug build measures the debug overhead,
not the engines. Leave the phone alone while it runs: a touch backgrounds the
app and the rows stop.

`run.mjs` flags:

| flag | default | |
|---|---|---|
| `--engines` | `tgfx,skia` | engine order; `skia,tgfx` runs skia first |
| `--scenes` | all fourteen | subset, e.g. `paths,anim-imp`, or `paths7500` for another path count |
| `--views` | `surface,texture` | outer loop of the matrix |
| `--skip` | none | `engine:scene` pairs to leave out, e.g. `tgfx:anim-imp` |
| `--order` | `sequential` | `alternate` runs every engine per scene |
| `--reps` | `1` | repeat the matrix; present FPS is the median across reps |
| `--gap` | `0` | seconds idle between combos, app stopped, so heat from one run is not carried into the next |
| `--cool` | `0.99` | hold each combo until the kernel's CPU frequency cap (`scaling_max_freq / cpuinfo_max_freq`) is back above this; `0` skips the wait |
| `--cool-timeout` | `600` | give up waiting after this many seconds and run anyway (the row's `CPU cap %` shows it) |
| `--dif` | `on` | `off` runs skia's text scene without `deviceIndependentFonts` |
| `--imp` | `ui` | `js` drives tgfx's `anim-imp` handles from the JS thread |
| `--present` | `atrace` | `latency` on Android ≤ 13, where `atrace gfx` has no SurfaceFlinger `queueBuffer` events |
| `--surface-layer`, `--texture-layer` | see `run.mjs` | the `queueBuffer - <layer>` regex counted per view; a TextureView is counted on the app window's layer |
| `--package` | `com.tgfxskiabench` | |

The runner builds the plan and launches the app once per combo, in a fresh
process (`bench://run?engines=<one>&scenes=<one>&views=<one>`): in one
long-lived process the heavy scenes leave heap and caches behind, and the rows
after them are measured in a different state. The app still accepts a whole
matrix in one URL (`engines=…&scenes=…&views=…&order=…&reps=…&gap=…`) for
other launchers.

## Reading the numbers

- **Present FPS** is what the canvas actually put on screen, counted at
  SurfaceFlinger. Thread FPS says the threads are healthy, nothing more: tgfx's
  render loop coalesces off-thread, so UI can read 120 while the canvas
  presents 8.
- **CPU %** is the whole process, 100 = one core, timed on the device clock.
  The second table splits it by thread (two `/proc/<pid>/task` snapshots 8 s
  apart; pool threads summed under one name, so `RNSkia Render 1–4` reads as
  one `RNSkia Render`). **Graphics / Native / Java MB** are the `dumpsys
  meminfo` App Summary rows; Graphics is GPU buffers and textures.
- Every engine gets a parity still per scene in `bench/shots/` (the app freezes
  the rotation at 0 for the first 1.5 s). Check them — a canvas that draws
  nothing benchmarks at 120 fps.
- **CPU cap %** is the lowest `scaling_max_freq / cpuinfo_max_freq` seen during
  the combo. Below 100 the kernel was thermally capping the clocks and a
  CPU-bound row is not comparable: a Galaxy S25 Edge at thermal status 1 had
  its clusters at 1.8 of 3.5 GHz and 1.7 of 4.5 GHz, and skia's text row read
  45 or 90 fps on the cap alone. The runner waits for the cap to lift before
  each combo (`--cool`); the thermal status column alone does not show this.
- Present FPS is the mean of two 8 s windows per combo.
- Lock the refresh rate first (`settings put system peak_refresh_rate 120`,
  `min_refresh_rate 120` where the OEM allows it), make sure
  `animator_duration_scale` is `1`, and keep the phone cool between reps.

Measured tables live in `bench/RESULTS.md` and the dated `bench/results-*.md`.

## Is it fair?

What every engine gets, identically:

- One set of layout arrays (`SHAPES`, `IMAGE_CELLS`, `pathsFor()`, `TEXTS`),
  one palette, one SkSL source, one stroke width, one 14 px sans-serif font,
  one rotation shared value. Each engine binds it the way its docs say to
  (tgfx slot props, skia `useDerivedValue`).
- Anti-aliasing on by default (`JsiSkPaint` sets it; tgfx encodes
  `antiAlias` unless `false`). Every canvas is `absoluteFill` and opaque, and
  in each view pass both engines draw through the same kind of view, so the
  present counter reads the same kind of layer: a `SurfaceView` (tgfx
  `composite="layer"`, skia `backingView: 'SurfaceView'`) or a `TextureView`
  (tgfx `composite="texture"`, skia `backingView: 'TextureView'`, its default).
- Skia's `text` canvas sets `deviceIndependentFonts` (3.10): the 6,000 blobs
  rotate every frame, the case it exists for. Other scenes leave it off.
- Vulkan on Android for both: tgfx by default, react-native-skia 3 because
  Graphite is its only Android backend.
- The same measurement: present FPS at SurfaceFlinger, thread FPS from a
  frame callback and `requestAnimationFrame` that know nothing about any
  engine, CPU and PSS for the whole process, a 3 s settle, a 20 s window,
  a release build with Hermes and the new architecture.
- Assets ready before combo 0 on every side.

What differs, on purpose:

- **Threading.** tgfx renders on its own `TgfxRender` thread; skia 3.8 records
  on a four-thread `RNSkia Render` pool and submits from `RNSkia Present`. Neither
  drags the UI or JS thread below the refresh rate on any scene (3.0's `Canvas`
  fell to 30/30 on the shader; 3.8.1 holds 90/90).
- **Stress, not typical.** Static scenes under one animated group at extreme
  counts measure the draw path, not scene rebuilds.

Samsung SM-E146B (Exynos 1330, Android 15, 90 Hz), react-native-skia 3.8.1,
measured independently: a separate app re-implementing these scenes and a separate
runner (SurfaceFlinger `--latency` present timestamps), engines alternating, mean of
2 runs, thermal status 0–1 throughout
(`bench/results-2026-10-29-samsung-90hz-skia381-independent.md`, which also has
neutral layouts):

| scene | tgfx | skia 3.8.1 | skia 3.0.0 `Canvas` (Oct 2) | skia 2.11.1 `Canvas` (GL, Sep 16) |
|---|---|---|---|---|
| shapes | 60.5 | 25.8 | 20.4 | 27.0 |
| images | 90.3 | 66.1 | 42.1 | 82.4 |
| shader | 15.0 | 9.3 | 15.0 | 15.1 |
| pattern | 90.3 | 84.8 | 89.9 | 90.3 |
| paths | 90.3 | 17.6 | 82.5 | 90.0 |
| text | 68.3 | 34.4 | 25.4 | 33.8 |

UI and JS hold at 90 for both engines in every row. Skia 3.8.1's shader and paths
rows run at 99–100 % GPU busy at the full 949 MHz; this app and `bench/run.mjs`
reproduce them (paths 17.8, shader 9.3:
`bench/results-2026-10-29-samsung-90hz-skia381-crosscheck.md`).
