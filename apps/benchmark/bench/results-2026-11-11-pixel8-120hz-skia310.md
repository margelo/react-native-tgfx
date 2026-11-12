# tgfx vs react-native-skia 3.10.0 on a Pixel 8

Google Pixel 8 (Tensor G3, Android 17, 1080x2400, 120 Hz), release
build, Hermes, new architecture. react-native-tgfx 0.3.0 from source (`552cd87`,
tgfx submodule `1b2a429`), react-native-skia 3.10.0 from npm.

`node bench/run.mjs --order alternate --reps 2 --gap 10 --cool 0.95 --cool-timeout 240 --skip tgfx:anim-imp`,
one view at a time.

Every combo ran twice, each time in a fresh process started once the CPU
frequency cap was back above 95 %. Present FPS is the median of the four 8 s
windows (two per run), counted at SurfaceFlinger. Raw output:
`results-2026-11-11-pixel8-120hz-skia310-raw.md`.

## Present FPS

| scene | tgfx surface | skia surface | tgfx texture | skia texture |
|---|---|---|---|---|
| shapes, 20k (tgfx nodes, skia ShapeBlob) | 116.3 | 118.3 | 90.1 | **116.9** |
| shapes-nodes, 20k nodes on both | **116.8** | 54.9 | **87.9** | 53.4 |
| shapes-atlas, one atlas on both | 118.8 | 118.6 | 115.6 | 117.0 |
| shapes-picture, 20k draws recorded once | **115.0** | 63.3 | **84.4** | 61.0 |
| images, 3,600 | 119.0 | 111.6 | **108.0** | 85.1 |
| shader | **117.2** | 49.5 | **96.3** | 47.9 |
| pattern | 119.1 | 117.8 | 115.1 | 116.3 |
| paths, 900 | 118.9 | 118.4 | 102.3 | **116.8** |
| paths, 2,500 | 103.7 | **118.3** | 96.5 | **115.9** |
| paths, 5,000 | 46.8 | **117.6** | 46.6 | **115.4** |
| paths, 10,000 | 21.0 | **75.4** | 20.9 | **76.4** |
| text, 6,000 (skia `deviceIndependentFonts`) | **84.8** | 41.8 | **81.8** | 41.4 |
| anim-decl, 5k shapes, two derived values each | 23.9 | **45.8** | 4.0 | **11.9** |
| anim-imp, 5k shapes, one worklet | not run | 100.7 | not run | 25.3 |

Bold: ahead by more than 5 %.

## CPU

| scene | tgfx surface | skia surface | tgfx texture | skia texture |
|---|---|---|---|---|
| shapes | 329 % | 109 % | 341 % | 141 % |
| shapes-nodes | 332 % | 173 % | 344 % | 192 % |
| shader | 62 % | 57 % | 82 % | 66 % |
| paths, 5,000 | 126 % | 152 % | 143 % | 179 % |
| paths, 10,000 | 123 % | 154 % | 131 % | 174 % |
| text | 231 % | 163 % | 245 % | 175 % |

Whole process, 100 = one core.

## Findings

- **Shapes.** Each engine's fastest static path (`shapes`): both sit at the
  ceiling on SurfaceView, tgfx with `TgfxRender` at 250 % and skia's ShapeBlob
  at a third of the CPU (109 vs 329 %). With 20k declarative nodes on both,
  tgfx draws 2.1x skia (117 vs 55 surface); skia's `RNSkia Render` is at 91 %.
- **Paths.** Both hold the ceiling at 900. From 2,500 on `TgfxRender` is
  saturated (100 %) and tgfx falls to 47 at 5,000 and 21 at 10,000. skia holds
  118 up to 5,000 and 75 at 10,000, where `RNSkia Render` reaches 97 %. This
  is the reverse of the SM-E146B, where skia is GPU-bound at every count
  (`results-2026-11-11-samsung-90hz-skia310-cache-floor.md`).
- **Shader.** tgfx holds 117 surface; skia draws 50 with its threads idle
  (`RNSkia Present` 18 %, `RNSkia Render` 5 %), so it is GPU-bound here. Not
  investigated.
- **Text and recorded shapes.** tgfx leads by 2.0x and 1.4-1.8x; skia's
  `RNSkia Render` is the limit on text (97 %).
- **Per-shape animation** is UI-thread bound for both (UI thread 96-99 %).
  Declarative: skia 1.9x on SurfaceView and 3x on TextureView. tgfx `anim-imp`
  is skipped by the runner and was not timed separately on this phone.
- **SurfaceView vs TextureView.** tgfx's static rows lose up to 27 % on
  TextureView (shapes 116 to 90, shader 117 to 96); skia's are within 4 %
  except images (112 to 85). The animated rows fall to a quarter or less on
  both engines.

## Conditions

- Thermal status 1 for both halves. The CPU cap was back above 95 % at the
  start of every combo and dipped to 74-92 % mid-combo on the CPU-bound rows
  (lowest: both `anim-decl` rows at 74 %, skia 10,000 paths and tgfx text at
  79 % on SurfaceView), so read differences under ~10 % there as noise.
- The panel was locked at 120 Hz (`peak_refresh_rate` and `min_refresh_rate`).
- The parity stills of shader and 10,000 paths show the same picture on both
  engines.
- Run by the react-native-skia maintainer, with the runner and command above
  unchanged.
