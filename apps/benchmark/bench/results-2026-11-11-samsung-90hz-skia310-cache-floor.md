# GPU cache floor: before and after on a mid-range phone

Same phone, build setup, scenes and runner as
`results-2026-11-11-samsung-90hz-skia310.md` (the "before" build). The only
change is the 256 MB floor on a canvas's GPU cache. The two builds ran
interleaved by view, before surface, after surface, after texture, before
texture, so neither got the cooler phone. Raw output:
`results-2026-11-11-samsung-90hz-skia310-cache-floor-raw.md`.

## What moved

| tgfx, 10,000 paths | before | after |
|---|---|---|
| surface, present FPS | 8.8 | **21.8** |
| texture, present FPS | 4.8 | **20.4** |
| surface, CPU | 167 % | 110 % |
| texture, CPU | 204 % | 115 % |
| surface, Graphics MB | 242 | 377 |
| texture, Graphics MB | 269 | 336 |

The geometry now stays in the cache: `TgfxRender` drops from 144-151 % to
96-101 % and is the limit, as at 5,000 paths, and the runs are steady (22.1
and 20.0 surface, 20.1 and 20.4 texture, against 9.7 and 8.2, 10.7 and 4.3
before). tgfx now draws 2x skia at 10,000 paths. The cost is the cached
geometry: 135 MB more Graphics memory on SurfaceView, 67 MB on TextureView.

No other row moved beyond run-to-run noise. The largest other differences
are on CPU-bound tgfx shapes rows, in both directions: shapes +5 % surface
and +7 % texture, shapes-nodes +8 % texture, shapes-picture -5 % surface.
Those rows vary that much between runs at a different CPU cap or thermal
status (the before TextureView half ran at thermal status 2, the after one
at 1). skia's static rows are within 1.2 %, its animated rows within 6 %.

## Present FPS, after

| scene | tgfx surface | skia surface | tgfx texture | skia texture |
|---|---|---|---|---|
| shapes, 20k (tgfx nodes, skia ShapeBlob) | 64.3 | **89.3** | 60.1 | **89.0** |
| shapes-nodes, 20k nodes on both | **62.8** | 25.9 | **59.1** | 25.3 |
| shapes-atlas, one atlas on both | 89.9 | 89.5 | 88.9 | 89.2 |
| shapes-picture, 20k draws recorded once | **79.1** | 26.0 | **70.4** | 25.3 |
| images, 3,600 | 90.1 | 88.4 | 88.7 | 86.1 |
| shader | 15.1 | 14.8 | 12.9 | 14.3 |
| pattern | 90.2 | 89.5 | 88.9 | 89.3 |
| paths, 900 | **90.1** | 27.3 | **88.4** | 26.5 |
| paths, 2,500 | **83.7** | 27.0 | **71.9** | 26.2 |
| paths, 5,000 | **44.0** | 17.9 | **40.9** | 17.6 |
| paths, 10,000 | **21.8** | 10.3 | **20.4** | 10.1 |
| text, 6,000 (skia `deviceIndependentFonts`) | **73.1** | 32.2 | **66.0** | 30.4 |
| anim-decl, 5k shapes, two derived values each | 24.3 | **31.4** | 11.9 | 9.8 |
| anim-imp, 5k shapes, one worklet | ~17 by hand | 53.2 | ~6 by hand | 23.2 |

## Conditions

As in the before file. Thermal status 0 for the after SurfaceView half, 1
for the after TextureView half.
