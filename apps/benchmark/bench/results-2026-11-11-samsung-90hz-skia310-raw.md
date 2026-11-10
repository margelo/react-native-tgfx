# Raw: Samsung SM-E146B, 90 Hz, react-native-skia 3.10.0

`node bench/run.mjs --order alternate --reps 2 --gap 10 --cool 0.95 --cool-timeout 240 --skip tgfx:anim-imp --views <view>`, once per view.

## SurfaceView

| engine · scene · view | Present FPS | UI FPS | JS FPS | CPU % (1 core = 100) | PSS MB | thermal | CPU cap % | ticks |
|---|---|---|---|---|---|---|---|---|
| tgfx · shapes · surface | 61.3 | 90 | 90 | 189 | 389.5 | 2 | 68 | 53 |
| skia · shapes · surface | 89.4 | 91 | 91 | 70 | 322.4 | 2 | 100 | 53 |
| tgfx · shapes-nodes · surface | 62.3 | 91 | 90 | 184 | 389.6 | 2 | 80 | 53 |
| skia · shapes-nodes · surface | 26.1 | 91 | 90 | 95 | 454.1 | 2 | 100 | 53 |
| tgfx · shapes-atlas · surface | 90.0 | 91 | 91 | 48 | 369.3 | 2 | 100 | 52 |
| skia · shapes-atlas · surface | 89.4 | 91 | 91 | 70 | 320.7 | 2 | 100 | 52 |
| tgfx · images · surface | 90.1 | 91 | 91 | 78 | 335.7 | 2 | 100 | 53 |
| skia · images · surface | 88.1 | 91 | 91 | 111 | 344.7 | 2 | 92 | 53 |
| tgfx · shader · surface | 15.0 | 91 | 91 | 25 | 329.4 | 2 | 100 | 53 |
| skia · shader · surface | 14.8 | 91 | 91 | 28 | 305.6 | 2 | 100 | 53 |
| tgfx · pattern · surface | 90.1 | 91 | 91 | 46 | 325.9 | 1 | 100 | 53 |
| skia · pattern · surface | 89.6 | 91 | 91 | 58 | 300.7 | 1 | 100 | 53 |
| tgfx · paths900 · surface | 90.3 | 91 | 91 | 76 | 348.6 | 0 | 100 | 53 |
| skia · paths900 · surface | 27.2 | 91 | 90 | 52 | 405.5 | 0 | 100 | 53 |
| tgfx · paths2500 · surface | 82.6 | 91 | 90 | 113 | 380.4 | 0 | 98 | 52 |
| skia · paths2500 · surface | 27.1 | 91 | 90 | 60 | 413.6 | 0 | 100 | 53 |
| tgfx · paths5000 · surface | 43.8 | 91 | 90 | 111 | 489.8 | 0 | 100 | 53 |
| skia · paths5000 · surface | 17.8 | 91 | 90 | 53 | 430.1 | 0 | 100 | 53 |
| tgfx · paths · surface | 8.8 | 91 | 90 | 167 | 521.9 | 0 | 100 | 53 |
| skia · paths · surface | 10.3 | 91 | 91 | 47 | 453.7 | 0 | 100 | 53 |
| tgfx · text · surface | 73.0 | 91 | 90 | 128 | 362.0 | 0 | 100 | 53 |
| skia · text · surface | 32.4 | 91 | 91 | 122 | 402.5 | 0 | 100 | 53 |
| tgfx · anim-decl · surface | 24.6 | 34 | 17 | 224 | 500.1 | 0 | 92 | 51 |
| skia · anim-decl · surface | 32.3 | 32 | 16 | 143 | 474.6 | 0 | 98 | 51 |
| skia · anim-imp · surface | 54.9 | 79 | 40 | 162 | 358.6 | 0 | 95 | 51 |
| tgfx · shapes-picture · surface | 83.1 | 91 | 90 | 145 | 392.3 | 0 | 98 | 53 |
| skia · shapes-picture · surface | 26.1 | 91 | 90 | 84 | 420.4 | 0 | 100 | 53 |

`thermal` is the highest Android thermal status (0 none … 3 severe) seen at the start of the combo's runs. `CPU cap %` is the lowest scaling_max_freq / cpuinfo_max_freq seen during them: below 100 the kernel was throttling, whatever the status says.

### Where the CPU and memory go

| engine · scene · view | UI thread % | JS thread % | busiest other threads % | Graphics MB | Native MB | Java MB |
|---|---|---|---|---|---|---|
| tgfx · shapes · surface | 7 | 2 | TgfxRender 150, nitro-thread 18, binder 6 | 161.1 | 142.2 | 4.0 |
| skia · shapes · surface | 8 | 2 | RNSkia Present 24, RNSkia Render 16, binder 7 | 134.9 | 106.5 | 4.8 |
| tgfx · shapes-nodes · surface | 7 | 2 | TgfxRender 148, nitro-thread 18, binder 6 | 161.1 | 141.7 | 4.4 |
| skia · shapes-nodes · surface | 6 | 1 | RNSkia Render 57, RNSkia Present 22, binder 4 | 239.4 | 118.5 | 4.6 |
| tgfx · shapes-atlas · surface | 10 | 2 | TgfxRender 17, binder 7, mali-cmar-backe 7 | 149.4 | 124.9 | 4.4 |
| skia · shapes-atlas · surface | 8 | 2 | RNSkia Present 23, RNSkia Render 16, mali-cmar-backe 7 | 134.9 | 105.9 | 4.8 |
| tgfx · images · surface | 7 | 1 | TgfxRender 54, binder 5, mali-cmar-backe 5 | 143.4 | 111.7 | 4.4 |
| skia · images · surface | 6 | 1 | RNSkia Render 58, RNSkia Present 37, binder 5 | 150.4 | 110.8 | 4.8 |
| tgfx · shader · surface | 12 | 3 | binder 4, TgfxRender 4, mali-cmar-backe 1 | 145.1 | 104.7 | 4.4 |
| skia · shader · surface | 12 | 3 | RNSkia Present 5, binder 3, mali-cmar-backe 1 | 119.8 | 103.5 | 4.5 |
| tgfx · pattern · surface | 10 | 2 | TgfxRender 15, binder 7, mali-cmar-backe 6 | 143.3 | 104.3 | 4.4 |
| skia · pattern · surface | 9 | 2 | RNSkia Present 24, binder 7, mali-cmar-backe 7 | 118.1 | 102.1 | 4.8 |
| tgfx · paths900 · surface | 7 | 1 | TgfxRender 53, binder 5, mali-cmar-backe 4 | 158.0 | 112.3 | 4.4 |
| skia · paths900 · surface | 12 | 3 | RNSkia Render 13, RNSkia Present 11, mali-cmar-backe 5 | 219.4 | 103.6 | 4.6 |
| tgfx · paths2500 · surface | 6 | 1 | TgfxRender 95, binder 6, mali-cmar-backe 3 | 175.8 | 123.2 | 4.4 |
| skia · paths2500 · surface | 11 | 3 | RNSkia Render 27, RNSkia Present 9, mali-cmar-backe 4 | 224.4 | 104.6 | 4.6 |
| tgfx · paths5000 · surface | 6 | 1 | TgfxRender 98, binder 5, mali-cmar-backe 2 | 259.1 | 148.6 | 4.4 |
| skia · paths5000 · surface | 11 | 3 | RNSkia Render 25, RNSkia Present 6, mali-cmar-backe 4 | 230.5 | 109.5 | 4.5 |
| tgfx · paths · surface | 6 | 1 | TgfxRender 144, nitro-thread 13, binder 4 | 241.5 | 186.6 | 4.4 |
| skia · paths · surface | 11 | 3 | RNSkia Render 22, RNSkia Present 4, mali-cmar-backe 4 | 251.4 | 109.7 | 4.5 |
| tgfx · text · surface | 6 | 1 | TgfxRender 101, nitro-thread 11, binder 5 | 151.5 | 128.8 | 4.4 |
| skia · text · surface | 5 | 1 | RNSkia Render 93, RNSkia Present 17, binder 4 | 195.3 | 118.3 | 4.6 |
| tgfx · anim-decl · surface | 97 | 0 | TgfxRender 98, nitro-thread 15, binder 4 | 152.6 | 189.0 | 4.4 |
| skia · anim-decl · surface | 98 | 0 | RNSkia Render 27, RNSkia Present 15, binder 4 | 141.3 | 177.1 | 4.5 |
| skia · anim-imp · surface | 97 | 1 | RNSkia Render 33, RNSkia Present 26, binder 6 | 153.9 | 123.5 | 4.6 |
| tgfx · shapes-picture · surface | 6 | 1 | TgfxRender 121, nitro-thread 13, binder 4 | 161.1 | 144.5 | 4.4 |
| skia · shapes-picture · surface | 7 | 2 | RNSkia Render 44, RNSkia Present 24, binder 4 | 230.1 | 113.0 | 4.5 |

## TextureView

| engine · scene · view | Present FPS | UI FPS | JS FPS | CPU % (1 core = 100) | PSS MB | thermal | CPU cap % | ticks |
|---|---|---|---|---|---|---|---|---|
| tgfx · shapes · texture | 56.4 | 90 | 90 | 202 | 421.2 | 2 | 80 | 53 |
| skia · shapes · texture | 89.1 | 91 | 91 | 87 | 337.7 | 2 | 100 | 53 |
| tgfx · shapes-nodes · texture | 54.6 | 90 | 90 | 200 | 424.5 | 2 | 80 | 53 |
| skia · shapes-nodes · texture | 25.4 | 91 | 90 | 101 | 491.6 | 2 | 98 | 52 |
| tgfx · shapes-atlas · texture | 88.1 | 91 | 91 | 76 | 401.4 | 2 | 100 | 53 |
| skia · shapes-atlas · texture | 89.1 | 91 | 91 | 88 | 338.6 | 2 | 98 | 53 |
| tgfx · images · texture | 88.8 | 91 | 91 | 99 | 368.0 | 2 | 98 | 53 |
| skia · images · texture | 85.1 | 91 | 90 | 134 | 364.6 | 2 | 84 | 53 |
| tgfx · shader · texture | 12.6 | 45 | 44 | 22 | 364.7 | 2 | 100 | 51 |
| skia · shader · texture | 14.3 | 33 | 31 | 23 | 326.0 | 2 | 100 | 51 |
| tgfx · pattern · texture | 89.0 | 91 | 91 | 77 | 358.6 | 2 | 100 | 53 |
| skia · pattern · texture | 88.9 | 91 | 91 | 77 | 318.5 | 2 | 76 | 53 |
| tgfx · paths900 · texture | 88.4 | 91 | 90 | 95 | 378.9 | 2 | 92 | 53 |
| skia · paths900 · texture | 26.6 | 66 | 65 | 52 | 426.3 | 2 | 100 | 51 |
| tgfx · paths2500 · texture | 72.5 | 91 | 90 | 132 | 472.1 | 2 | 80 | 53 |
| skia · paths2500 · texture | 26.3 | 68 | 66 | 62 | 436.2 | 2 | 100 | 51 |
| tgfx · paths5000 · texture | 41.4 | 91 | 90 | 121 | 515.5 | 2 | 80 | 53 |
| skia · paths5000 · texture | 17.6 | 72 | 70 | 53 | 448.2 | 2 | 100 | 51 |
| tgfx · paths · texture | 4.8 | 90 | 90 | 204 | 545.9 | 2 | 80 | 53 |
| skia · paths · texture | 10.1 | 79 | 78 | 47 | 477.6 | 2 | 100 | 52 |
| tgfx · text · texture | 65.4 | 90 | 90 | 146 | 392.5 | 2 | 80 | 53 |
| skia · text · texture | 30.3 | 88 | 86 | 131 | 420.0 | 2 | 92 | 51 |
| tgfx · anim-decl · texture | 11.6 | 30 | 16 | 216 | 530.5 | 2 | 72 | 51 |
| skia · anim-decl · texture | 9.4 | 32 | 16 | 116 | 484.1 | 2 | 88 | 51 |
| skia · anim-imp · texture | 21.9 | 76 | 39 | 129 | 374.6 | 2 | 88 | 52 |
| tgfx · shapes-picture · texture | 69.3 | 90 | 90 | 171 | 425.2 | 2 | 88 | 53 |
| skia · shapes-picture · texture | 25.3 | 91 | 90 | 91 | 463.4 | 2 | 100 | 52 |

`thermal` is the highest Android thermal status (0 none … 3 severe) seen at the start of the combo's runs. `CPU cap %` is the lowest scaling_max_freq / cpuinfo_max_freq seen during them: below 100 the kernel was throttling, whatever the status says.

### Where the CPU and memory go

| engine · scene · view | UI thread % | JS thread % | busiest other threads % | Graphics MB | Native MB | Java MB |
|---|---|---|---|---|---|---|
| tgfx · shapes · texture | 10 | 2 | TgfxRender 148, nitro-thread 19, RenderThread 11 | 195.3 | 142.0 | 4.4 |
| skia · shapes · texture | 11 | 2 | RenderThread 20, RNSkia Present 17, RNSkia Render 15 | 149.9 | 106.8 | 4.7 |
| tgfx · shapes-nodes · texture | 10 | 2 | TgfxRender 144, nitro-thread 18, RenderThread 11 | 195.3 | 144.3 | 4.4 |
| skia · shapes-nodes · texture | 8 | 1 | RNSkia Render 57, RNSkia Present 23, mali-cmar-backe 4 | 277.3 | 119.7 | 4.5 |
| tgfx · shapes-atlas · texture | 13 | 2 | RenderThread 23, TgfxRender 15, mali-cmar-backe 13 | 183.6 | 125.4 | 4.4 |
| skia · shapes-atlas · texture | 11 | 2 | RenderThread 20, RNSkia Present 17, RNSkia Render 15 | 155.9 | 106.6 | 4.7 |
| tgfx · images · texture | 10 | 1 | TgfxRender 48, RenderThread 19, mali-cmar-backe 10 | 177.5 | 112.3 | 4.4 |
| skia · images · texture | 9 | 1 | RNSkia Render 60, RNSkia Present 40, RenderThread 14 | 171.3 | 111.2 | 4.7 |
| tgfx · shader · texture | 6 | 2 | RenderThread 4, TgfxRender 4, binder 4 | 183.2 | 105.2 | 4.4 |
| skia · shader · texture | 4 | 1 | RNSkia Present 4, RenderThread 4, mali-cmar-backe 3 | 144.8 | 103.8 | 4.4 |
| tgfx · pattern · texture | 12 | 2 | RenderThread 22, TgfxRender 14, mali-cmar-backe 13 | 177.4 | 105.1 | 4.4 |
| skia · pattern · texture | 11 | 2 | RenderThread 20, RNSkia Present 17, mali-cmar-backe 11 | 138.9 | 102.4 | 4.7 |
| tgfx · paths900 · texture | 10 | 2 | TgfxRender 52, RenderThread 17, mali-cmar-backe 9 | 191.2 | 112.3 | 4.4 |
| skia · paths900 · texture | 9 | 2 | RNSkia Render 12, RenderThread 8, RNSkia Present 8 | 244.8 | 103.8 | 4.5 |
| tgfx · paths2500 · texture | 10 | 1 | TgfxRender 95, RenderThread 13, mali-cmar-backe 7 | 266.2 | 124.1 | 4.4 |
| skia · paths2500 · texture | 8 | 2 | RNSkia Render 26, RNSkia Present 7, RenderThread 7 | 249.7 | 105.6 | 4.5 |
| tgfx · paths5000 · texture | 8 | 1 | TgfxRender 96, RenderThread 7, binder 4 | 291.7 | 143.3 | 4.4 |
| skia · paths5000 · texture | 8 | 2 | RNSkia Render 25, mali-cmar-backe 5, RNSkia Present 5 | 256.1 | 110.1 | 4.5 |
| tgfx · paths · texture | 7 | 1 | TgfxRender 151, nitro-thread 17, binder 4 | 268.8 | 185.9 | 4.4 |
| skia · paths · texture | 9 | 2 | RNSkia Render 22, mali-cmar-backe 4, binder 3 | 278.6 | 110.7 | 4.4 |
| tgfx · text · texture | 9 | 1 | TgfxRender 106, RenderThread 11, nitro-thread 9 | 185.7 | 129.0 | 4.4 |
| skia · text · texture | 6 | 1 | RNSkia Render 95, RNSkia Present 16, RenderThread 5 | 219.0 | 118.4 | 4.5 |
| tgfx · anim-decl · texture | 96 | 0 | TgfxRender 100, nitro-thread 9, RenderThread 3 | 186.6 | 189.0 | 4.4 |
| skia · anim-decl · texture | 98 | 0 | RNSkia Render 7, RNSkia Present 4, binder 3 | 148.7 | 177.9 | 4.4 |
| skia · anim-imp · texture | 97 | 1 | RNSkia Render 12, RNSkia Present 8, RenderThread 4 | 173.3 | 124.6 | 4.5 |
| tgfx · shapes-picture · texture | 10 | 2 | TgfxRender 122, nitro-thread 15, RenderThread 13 | 196.4 | 144.1 | 4.4 |
| skia · shapes-picture · texture | 8 | 1 | RNSkia Render 43, RNSkia Present 25, mali-cmar-backe 5 | 273.6 | 113.6 | 4.5 |
