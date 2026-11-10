# tgfx vs react-native-skia 3.10.0, SurfaceView and TextureView

Samsung SM-S937B (Galaxy S25 Edge, Android 16, 1080x2340, 120 Hz, motion
smoothness Adaptive), release build, Hermes, new architecture.
react-native-tgfx from source (tgfx submodule `fba0154`), react-native-skia
3.10.0 from npm.

`node bench/run.mjs --order alternate --gap 10 --skip tgfx:anim-imp`

Every combo ran in a fresh process, started only once the kernel's CPU
frequency cap had lifted. Present FPS is the mean of two 8 s windows, counted
at SurfaceFlinger (the SurfaceView's layer, or the app window's layer for a
TextureView). Raw output: `results-2026-11-10-s25edge-120hz-skia310-run3-raw.md`.

## Present FPS

| scene | tgfx surface | skia surface | tgfx texture | skia texture |
|---|---|---|---|---|
| shapes, 20k static (skia: ShapeBlob) | 89.9 | **119.4** | 86.9 | **119.3** |
| shapes-picture, 20k individual draws recorded once | 114.4 | 104.6 | 110.9 | 108.8 |
| images, 3,600 | 119.4 | 119.0 | 118.8 | 118.8 |
| shader | 119.6 | 119.3 | 119.0 | 119.0 |
| pattern | 119.6 | 119.3 | 118.8 | 119.4 |
| paths, 10,000 | 11.6 | **115.2** | 17.1 | **116.8** |
| text, 6,000 (skia `deviceIndependentFonts`) | **117.1** | 92.8 | **112.6** | 83.4 |
| anim-decl, 5k shapes, two derived values each | 35.2 | **75.4** | 22.1 | 21.5 |
| anim-imp, 5k shapes, one worklet | wedges | 118.6 | wedges | 55.1 |

Parity stills (t = 0) are in `bench/shots/`.

## Read this before quoting a number: the phone throttles within seconds

Android's thermal status stayed at 0-1 all day, yet the kernel capped the CPU
clusters to about half (1.8 of 3.5 GHz, 1.7 of 4.5 GHz) after a few heavy
combos, and the cap returns within seconds of a heavy scene starting even from
a cool start. CPU-bound rows follow the cap almost linearly: skia text read
45, 58 and 78 fps at big-core clocks of 1.96, 2.2 and 3.5 GHz.

The first two full runs of the day (one process for the whole matrix, no
cooling gate) are discarded for that reason; their sub-ceiling rows moved by up
to 40 % between runs. The runner now waits for the cap to lift before each
combo and prints the lowest cap seen during it (`CPU cap %` in the raw file).
Rows where the cap still fell below 70 % mid-combo: tgfx paths, tgfx text,
tgfx anim-decl, tgfx shapes (texture), skia text (texture, second window 71
vs 96). Rows at the ceiling and the large gaps (shapes, paths, anim-imp) are
safe; treat differences under ~15 % elsewhere as noise until rerun with reps.

## Findings

- **Static shapes.** With skia on its batched API (`Skia.ShapeBlob`, one
  `drawShapes` recorded once) it sits at the ceiling at 55 % of one core;
  tgfx's internal batching of 20k declarative nodes costs 227 % CPU for 90
  fps. As individual draws recorded once (`shapes-picture`) the engines are
  within noise of each other.
- **Paths.** The old 900-path scene is at the ceiling for both. Scaling it:
  2,500 both ~119; 5,000 tgfx 80 vs skia 114; 10,000 tgfx 12-17 vs skia 115.
  tgfx collapses past ~2,500 small paths; `TgfxRender` is saturated.
- **Text.** tgfx leads (117 vs 93 surface). See the text section below.
- **Per-shape animation** is UI-thread bound for both (UI thread 98-99 %).
  Declarative: skia 2x on SurfaceView, even on TextureView. Imperative: skia's
  per-frame `SkPicture` of 5k draws reaches the ceiling on SurfaceView; tgfx's
  node handles wedge the JS thread (below).
- **SurfaceView vs TextureView for skia.** No SurfaceView penalty: the
  below-ceiling static rows are within noise (shapes-picture 105 vs 109, paths
  115 vs 117, text 93 vs 83). The gaps seen in the discarded runs were the CPU
  cap. The display stayed in its 120 Hz mode (checked on SurfaceView). The anim rows are
  different: TextureView halves or worse (anim-imp 119 vs 55, anim-decl 75 vs
  22), for both engines; the UI thread is saturated there and a TextureView
  frame is only shown when the window redraws (not traced further).

## Skia text: where the time goes

`simpleperf` (user-space samples, 8 s) on the 6,000 rotating labels:

| | `<Text>`, DIF off | `<Text>`, DIF on | `<TextBlob>`, DIF on |
|---|---|---|---|
| render thread share of process samples | 72 % (thread ~99 % busy) | 66 % | 62 % (~85 % busy) |
| string to glyphs + bounds (`textToGlyphRunList`) | 27 % | 23 % | gone |
| GPU blob lookup/build (`findOrCreateBlob`) | 19 % | 22 % | 16 % (build 7 %) |
| atlas sub-run draw (`drawAtlasSubRun`, incl. `drawGeometry`) | 35 % | 35 % | 51 % |
| flush (`snapDrawPass`) | 7 % | 11 % | 14 % |

(percentages of the render thread, inclusive)

- `<Text>` calls `SkCanvas::drawSimpleText` per label per frame: the string is
  converted to glyphs and measured again every frame (about a quarter of the
  thread), and with no `SkTextBlob` behind the draw the GPU text blob is
  rebuilt every frame too.
- `deviceIndependentFonts` therefore buys nothing here: uncapped windows read
  ~104-108 fps with it off and ~91-98 with it on (`--dif off`). Distance
  field glyphs pay off when the blob is reused across frames.
- Prebuilt blobs (`--sktext blob`, `<TextBlob>`) remove the string conversion
  and most of the rebuild, and the render thread stops being saturated, but
  the frame rate did not move measurably (85-99 fps across runs). The GPU is
  not the limit (58-68 % busy at 160-312 MHz of 1,200). What limits that mode
  is open: the remaining per-draw Graphite recording (6,000 `drawGeometry`
  calls) is still ~9 ms a frame on one thread, and the present thread's time
  inside the Vulkan driver was not sampled (kernel time is invisible to this
  profile on this phone).
- tgfx holds 119 fps on the same scene with the big cores capped at 2.9 GHz,
  splitting the frame across `TgfxRender` (73 %) and a worker (25 %).

Raw text runs: `results-2026-11-10-s25edge-skia310-text-dif-{on,off}-raw.md`,
`results-2026-11-10-s25edge-skia310-textblob-dif-{on,off}-raw.md`.

## tgfx `anim-imp`: node handles do not scale

A `Scene` plus one `createHandle()` per node, written per frame with
`handle.set()`, wedges the JS thread at 5k and 20k nodes, from a UI worklet and
from a JS `requestAnimationFrame` loop alike (`--imp js`): creating the handles
costs ~580 µs each on the JS thread (5k: 2.9 s, 20k: 11.6 s; each allocates its
own native block, ~50 slot descriptors and ~6 Reanimated mutables), and once
running the JS thread and `TgfxRender` both sit at 100 % with no frame
completing. Skipped rather than measured.
