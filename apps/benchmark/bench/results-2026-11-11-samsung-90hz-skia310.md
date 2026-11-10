# tgfx vs react-native-skia 3.10.0 on a mid-range phone

Samsung SM-E146B (Exynos 1330, Mali-G68, Android 15, 1080x2408, 90 Hz),
release build, Hermes, new architecture. react-native-tgfx from source (tgfx
submodule `1b2a429`), react-native-skia 3.10.0 from npm.

`node bench/run.mjs --order alternate --reps 2 --gap 10 --cool 0.95 --cool-timeout 240 --skip tgfx:anim-imp`,
one view at a time.

Every combo ran twice, each time in a fresh process started once the CPU
frequency cap was back above 95 %. Present FPS is the median of the four 8 s
windows (two per run), counted at SurfaceFlinger. Raw output:
`results-2026-11-11-samsung-90hz-skia310-raw.md`.

## Present FPS

| scene | tgfx surface | skia surface | tgfx texture | skia texture |
|---|---|---|---|---|
| shapes, 20k (tgfx nodes, skia ShapeBlob) | 61.3 | **89.4** | 56.4 | **89.1** |
| shapes-nodes, 20k nodes on both | **62.3** | 26.1 | **54.6** | 25.4 |
| shapes-atlas, one atlas on both | 90.0 | 89.4 | 88.1 | 89.1 |
| shapes-picture, 20k draws recorded once | **83.1** | 26.1 | **69.3** | 25.3 |
| images, 3,600 | 90.1 | 88.1 | 88.8 | 85.1 |
| shader | 15.0 | 14.8 | 12.6 | 14.3 |
| pattern | 90.1 | 89.6 | 89.0 | 88.9 |
| paths, 900 | **90.3** | 27.2 | **88.4** | 26.6 |
| paths, 2,500 | **82.6** | 27.1 | **72.5** | 26.3 |
| paths, 5,000 | **43.8** | 17.8 | **41.4** | 17.6 |
| paths, 10,000 | 8.8 | 10.3 | 4.8 | **10.1** |
| text, 6,000 (skia `deviceIndependentFonts`) | **73.0** | 32.4 | **65.4** | 30.3 |
| anim-decl, 5k shapes, two derived values each | 24.6 | **32.3** | 11.6 | 9.4 |
| anim-imp, 5k shapes, one worklet | ~17 by hand | 54.9 | ~6 by hand | 21.9 |

## CPU

| scene | tgfx surface | skia surface | tgfx texture | skia texture |
|---|---|---|---|---|
| shapes | 189 % | 70 % | 202 % | 87 % |
| shapes-nodes | 184 % | 95 % | 200 % | 101 % |
| shapes-atlas | 48 % | 70 % | 76 % | 88 % |
| paths, 5,000 | 111 % | 53 % | 121 % | 53 % |
| paths, 10,000 | 167 % | 47 % | 204 % | 47 % |
| text | 128 % | 122 % | 146 % | 131 % |

Whole process, 100 = one core.

## Findings

- **Shapes.** Each engine's fastest static path (`shapes`): skia's ShapeBlob
  holds 89 fps; tgfx's 20k nodes reach 61 with `TgfxRender` saturated. With
  the technique held equal the picture flips: 20k declarative nodes on
  both, tgfx draws 2.2-2.4x skia (62 vs 26 surface); one atlas on both,
  both sit at the ceiling and tgfx's `<Vertices>` mesh uses less CPU (48 vs
  70 %).
- **Paths.** skia is GPU-bound on this Mali at every count: 27 fps at 900
  and 2,500, 18 at 5,000, 10 at 10,000, with its render pool under 30 %.
  tgfx holds 90 at 900 and 83 at 2,500, then `TgfxRender` saturates: 44 at
  5,000. At 10,000 it falls below skia, to 9 and 5, at 167 and 204 % CPU,
  and the two runs disagree (9.7 and 8.2 surface, 10.7 and 4.3 texture): the
  path geometry (about 86 MB) is larger than the canvas's GPU cache (64 MB),
  so it is evicted and rebuilt every frame.
- **Text and recorded shapes.** tgfx leads by 2.2x and 2.7-3.2x; skia's
  `RNSkia Render` is the limit on text (93 %).
- **Per-shape animation** is UI-thread bound for both (UI thread 96-98 %).
  Declarative: skia ahead on SurfaceView, even on TextureView. tgfx
  `anim-imp` is skipped by the runner; timed by hand inside the scene's
  measured period (atrace, 8 s): about 17 fps surface, 6 texture.
- **SurfaceView vs TextureView.** Static rows lose up to 17 % on TextureView
  for tgfx and up to 7 % for skia; `anim-decl` halves or worse on both.

## Conditions

- Thermal status 0-2 (2 for the whole TextureView half). The CPU cap was back
  above 95 % at the start of every combo; tgfx's CPU-bound rows (shapes,
  shapes-nodes, text, paths from 2,500 on TextureView) dipped to 68-80 %
  mid-combo, so read differences under ~10 % there as noise. skia's GPU-bound
  rows matched across reps and between the two builds to within 2 %.
- The notification shade was pulled down over the app for most of both
  builds' runs (water on the screen while cooling it), so the runner's
  parity stills show the shade. A back-to-back check with it closed and
  open, eight combos each: skia's rows matched within 1 %; tgfx's
  CPU-bound rows moved -5 to +8 %, in both directions, with the CPU cap.
  Stills of the shapes scenes taken afterwards match across engines.
