# Raw: Samsung SM-E146B, 90 Hz, react-native-skia 3.10.0, GPU cache floor

`node bench/run.mjs --order alternate --reps 2 --gap 10 --cool 0.95 --cool-timeout 240 --skip tgfx:anim-imp --views <view>`, once per view.

## SurfaceView

| engine · scene · view | Present FPS | UI FPS | JS FPS | CPU % (1 core = 100) | PSS MB | thermal | CPU cap % | ticks |
|---|---|---|---|---|---|---|---|---|
| tgfx · shapes · surface | 64.3 | 91 | 90 | 179 | 390.2 | 0 | 98 | 53 |
| skia · shapes · surface | 89.3 | 91 | 91 | 68 | 320.1 | 0 | 100 | 53 |
| tgfx · shapes-nodes · surface | 62.8 | 91 | 90 | 188 | 388.7 | 0 | 100 | 53 |
| skia · shapes-nodes · surface | 25.9 | 91 | 90 | 95 | 465.7 | 0 | 100 | 52 |
| tgfx · shapes-atlas · surface | 89.9 | 91 | 91 | 48 | 368.3 | 0 | 100 | 53 |
| skia · shapes-atlas · surface | 89.5 | 91 | 91 | 67 | 321.3 | 0 | 100 | 53 |
| tgfx · images · surface | 90.1 | 91 | 91 | 80 | 334.5 | 0 | 100 | 53 |
| skia · images · surface | 88.4 | 91 | 90 | 111 | 344.0 | 0 | 100 | 53 |
| tgfx · shader · surface | 15.1 | 91 | 91 | 25 | 329.0 | 0 | 100 | 53 |
| skia · shader · surface | 14.8 | 91 | 91 | 27 | 303.3 | 0 | 100 | 53 |
| tgfx · pattern · surface | 90.2 | 91 | 91 | 48 | 324.8 | 0 | 100 | 53 |
| skia · pattern · surface | 89.5 | 91 | 91 | 61 | 299.6 | 0 | 100 | 53 |
| tgfx · paths900 · surface | 90.1 | 91 | 91 | 75 | 344.1 | 0 | 100 | 53 |
| skia · paths900 · surface | 27.3 | 91 | 91 | 50 | 403.0 | 0 | 100 | 53 |
| tgfx · paths2500 · surface | 83.7 | 91 | 91 | 113 | 446.7 | 0 | 100 | 53 |
| skia · paths2500 · surface | 27.0 | 91 | 90 | 59 | 411.9 | 0 | 100 | 53 |
| tgfx · paths5000 · surface | 44.0 | 91 | 91 | 111 | 482.8 | 0 | 100 | 53 |
| skia · paths5000 · surface | 17.9 | 91 | 90 | 51 | 424.1 | 0 | 100 | 53 |
| tgfx · paths · surface | 21.8 | 91 | 90 | 110 | 657.1 | 0 | 100 | 53 |
| skia · paths · surface | 10.3 | 91 | 91 | 47 | 455.1 | 0 | 100 | 53 |
| tgfx · text · surface | 73.1 | 91 | 90 | 129 | 360.8 | 0 | 98 | 53 |
| skia · text · surface | 32.2 | 91 | 90 | 121 | 399.6 | 0 | 100 | 53 |
| tgfx · anim-decl · surface | 24.3 | 32 | 17 | 218 | 499.7 | 0 | 95 | 51 |
| skia · anim-decl · surface | 31.4 | 31 | 16 | 144 | 489.1 | 0 | 95 | 51 |
| skia · anim-imp · surface | 53.2 | 78 | 39 | 162 | 358.0 | 0 | 92 | 52 |
| tgfx · shapes-picture · surface | 79.1 | 91 | 90 | 150 | 390.5 | 0 | 100 | 53 |
| skia · shapes-picture · surface | 26.0 | 91 | 90 | 84 | 425.4 | 0 | 100 | 53 |

`thermal` is the highest Android thermal status (0 none … 3 severe) seen at the start of the combo's runs. `CPU cap %` is the lowest scaling_max_freq / cpuinfo_max_freq seen during them: below 100 the kernel was throttling, whatever the status says.

### Where the CPU and memory go

| engine · scene · view | UI thread % | JS thread % | busiest other threads % | Graphics MB | Native MB | Java MB |
|---|---|---|---|---|---|---|
| tgfx · shapes · surface | 7 | 2 | TgfxRender 146, nitro-thread 18, binder 6 | 161.1 | 143.7 | 4.4 |
| skia · shapes · surface | 8 | 2 | RNSkia Present 23, RNSkia Render 16, mali-cmar-backe 7 | 134.9 | 106.6 | 4.8 |
| tgfx · shapes-nodes · surface | 7 | 2 | TgfxRender 152, nitro-thread 19, binder 6 | 161.1 | 141.5 | 4.4 |
| skia · shapes-nodes · surface | 7 | 1 | RNSkia Render 58, RNSkia Present 23, mali-cmar-backe 3 | 250.8 | 119.3 | 4.5 |
| tgfx · shapes-atlas · surface | 10 | 2 | TgfxRender 17, binder 7, mali-cmar-backe 7 | 149.5 | 124.7 | 4.4 |
| skia · shapes-atlas · surface | 8 | 2 | RNSkia Present 23, RNSkia Render 16, mali-cmar-backe 7 | 134.9 | 106.7 | 4.8 |
| tgfx · images · surface | 7 | 1 | TgfxRender 50, binder 5, mali-cmar-backe 5 | 143.5 | 111.9 | 4.4 |
| skia · images · surface | 6 | 1 | RNSkia Render 59, RNSkia Present 37, binder 5 | 150.4 | 110.8 | 4.7 |
| tgfx · shader · surface | 12 | 3 | binder 4, TgfxRender 4, mali-cmar-backe 2 | 145.1 | 105.2 | 4.4 |
| skia · shader · surface | 12 | 3 | RNSkia Present 5, binder 3, mali-cmar-backe 1 | 119.9 | 103.1 | 4.5 |
| tgfx · pattern · surface | 11 | 2 | TgfxRender 18, mali-cmar-backe 8, binder 8 | 143.3 | 104.7 | 4.4 |
| skia · pattern · surface | 9 | 2 | RNSkia Present 24, mali-cmar-backe 7, binder 7 | 118.1 | 102.1 | 4.7 |
| tgfx · paths900 · surface | 7 | 1 | TgfxRender 54, binder 5, mali-cmar-backe 4 | 158.0 | 112.0 | 4.4 |
| skia · paths900 · surface | 12 | 3 | RNSkia Render 12, RNSkia Present 11, mali-cmar-backe 4 | 219.4 | 103.1 | 4.5 |
| tgfx · paths2500 · surface | 6 | 1 | TgfxRender 96, binder 6, mali-cmar-backe 4 | 242.1 | 123.6 | 4.4 |
| skia · paths2500 · surface | 11 | 3 | RNSkia Render 27, RNSkia Present 9, mali-cmar-backe 4 | 224.4 | 104.4 | 4.5 |
| tgfx · paths5000 · surface | 7 | 1 | TgfxRender 96, binder 4, mali-cmar-backe 2 | 257.5 | 142.4 | 4.4 |
| skia · paths5000 · surface | 10 | 3 | RNSkia Render 25, RNSkia Present 6, mali-cmar-backe 4 | 230.5 | 109.2 | 4.5 |
| tgfx · paths · surface | 6 | 1 | TgfxRender 96, binder 3, mali-cmar-backe 1 | 377.1 | 173.7 | 4.4 |
| skia · paths · surface | 11 | 3 | RNSkia Render 22, mali-cmar-backe 4, RNSkia Present 3 | 253.1 | 109.7 | 4.4 |
| tgfx · text · surface | 6 | 1 | TgfxRender 108, nitro-thread 8, binder 6 | 151.6 | 128.6 | 4.4 |
| skia · text · surface | 6 | 1 | RNSkia Render 93, RNSkia Present 17, binder 4 | 197.2 | 117.5 | 4.5 |
| tgfx · anim-decl · surface | 96 | 0 | TgfxRender 99, nitro-thread 13, binder 6 | 152.6 | 189.0 | 4.4 |
| skia · anim-decl · surface | 98 | 0 | RNSkia Render 24, RNSkia Present 14, binder 4 | 152.8 | 177.4 | 4.5 |
| skia · anim-imp · surface | 97 | 1 | RNSkia Render 35, RNSkia Present 26, binder 6 | 153.9 | 123.3 | 4.6 |
| tgfx · shapes-picture · surface | 7 | 2 | TgfxRender 124, nitro-thread 14, binder 6 | 161.1 | 143.9 | 4.4 |
| skia · shapes-picture · surface | 7 | 2 | RNSkia Render 43, RNSkia Present 24, binder 3 | 233.0 | 113.1 | 4.5 |

## TextureView

| engine · scene · view | Present FPS | UI FPS | JS FPS | CPU % (1 core = 100) | PSS MB | thermal | CPU cap % | ticks |
|---|---|---|---|---|---|---|---|---|
| tgfx · shapes · texture | 60.1 | 90 | 90 | 201 | 423.1 | 1 | 84 | 53 |
| skia · shapes · texture | 89.0 | 91 | 91 | 87 | 341.0 | 1 | 100 | 53 |
| tgfx · shapes-nodes · texture | 59.1 | 90 | 90 | 202 | 423.0 | 1 | 80 | 53 |
| skia · shapes-nodes · texture | 25.3 | 90 | 90 | 102 | 496.9 | 1 | 100 | 53 |
| tgfx · shapes-atlas · texture | 88.9 | 91 | 91 | 77 | 398.9 | 1 | 100 | 53 |
| skia · shapes-atlas · texture | 89.2 | 91 | 91 | 88 | 341.1 | 1 | 98 | 53 |
| tgfx · images · texture | 88.7 | 91 | 91 | 99 | 369.3 | 1 | 98 | 53 |
| skia · images · texture | 86.1 | 91 | 90 | 127 | 363.6 | 1 | 92 | 53 |
| tgfx · shader · texture | 12.9 | 45 | 45 | 22 | 366.6 | 1 | 100 | 51 |
| skia · shader · texture | 14.3 | 33 | 31 | 24 | 327.2 | 1 | 100 | 51 |
| tgfx · pattern · texture | 88.9 | 91 | 91 | 74 | 360.3 | 1 | 100 | 53 |
| skia · pattern · texture | 89.3 | 91 | 91 | 86 | 320.5 | 1 | 100 | 53 |
| tgfx · paths900 · texture | 88.4 | 91 | 91 | 95 | 381.9 | 1 | 98 | 53 |
| skia · paths900 · texture | 26.5 | 67 | 65 | 52 | 428.8 | 1 | 100 | 51 |
| tgfx · paths2500 · texture | 71.9 | 91 | 90 | 133 | 481.1 | 1 | 88 | 53 |
| skia · paths2500 · texture | 26.2 | 67 | 66 | 62 | 437.3 | 1 | 100 | 51 |
| tgfx · paths5000 · texture | 40.9 | 91 | 90 | 121 | 515.2 | 1 | 84 | 53 |
| skia · paths5000 · texture | 17.6 | 72 | 70 | 55 | 450.3 | 1 | 100 | 52 |
| tgfx · paths · texture | 20.4 | 91 | 90 | 115 | 605.1 | 1 | 88 | 53 |
| skia · paths · texture | 10.1 | 79 | 77 | 45 | 477.0 | 1 | 100 | 52 |
| tgfx · text · texture | 66.0 | 90 | 90 | 147 | 394.6 | 1 | 80 | 53 |
| skia · text · texture | 30.4 | 86 | 85 | 129 | 425.4 | 1 | 95 | 52 |
| tgfx · anim-decl · texture | 11.9 | 30 | 16 | 217 | 532.8 | 1 | 84 | 51 |
| skia · anim-decl · texture | 9.8 | 32 | 16 | 117 | 485.8 | 1 | 92 | 51 |
| skia · anim-imp · texture | 23.2 | 77 | 39 | 129 | 375.0 | 1 | 88 | 53 |
| tgfx · shapes-picture · texture | 70.4 | 91 | 90 | 171 | 427.1 | 1 | 92 | 53 |
| skia · shapes-picture · texture | 25.3 | 90 | 90 | 91 | 462.8 | 2 | 100 | 52 |

`thermal` is the highest Android thermal status (0 none … 3 severe) seen at the start of the combo's runs. `CPU cap %` is the lowest scaling_max_freq / cpuinfo_max_freq seen during them: below 100 the kernel was throttling, whatever the status says.

### Where the CPU and memory go

| engine · scene · view | UI thread % | JS thread % | busiest other threads % | Graphics MB | Native MB | Java MB |
|---|---|---|---|---|---|---|
| tgfx · shapes · texture | 10 | 2 | TgfxRender 147, nitro-thread 19, RenderThread 11 | 195.2 | 141.8 | 4.4 |
| skia · shapes · texture | 11 | 2 | RenderThread 20, RNSkia Present 18, RNSkia Render 16 | 155.9 | 106.4 | 4.7 |
| tgfx · shapes-nodes · texture | 10 | 2 | TgfxRender 151, nitro-thread 14, RenderThread 11 | 195.3 | 142.2 | 4.4 |
| skia · shapes-nodes · texture | 8 | 1 | RNSkia Render 57, RNSkia Present 23, mali-cmar-backe 4 | 281.3 | 120.3 | 4.5 |
| tgfx · shapes-atlas · texture | 13 | 2 | RenderThread 23, TgfxRender 15, mali-cmar-backe 13 | 177.6 | 125.5 | 4.4 |
| skia · shapes-atlas · texture | 11 | 2 | RenderThread 20, RNSkia Present 17, RNSkia Render 15 | 155.9 | 106.6 | 4.7 |
| tgfx · images · texture | 10 | 1 | TgfxRender 46, RenderThread 19, mali-cmar-backe 10 | 177.5 | 112.5 | 4.4 |
| skia · images · texture | 9 | 1 | RNSkia Render 59, RNSkia Present 39, RenderThread 14 | 168.2 | 111.4 | 4.7 |
| tgfx · shader · texture | 6 | 2 | RenderThread 4, TgfxRender 4, binder 3 | 183.2 | 105.6 | 4.4 |
| skia · shader · texture | 4 | 1 | RenderThread 4, RNSkia Present 4, mali-cmar-backe 3 | 144.8 | 103.3 | 4.4 |
| tgfx · pattern · texture | 12 | 2 | RenderThread 23, TgfxRender 15, mali-cmar-backe 14 | 177.4 | 105.5 | 4.4 |
| skia · pattern · texture | 13 | 2 | RenderThread 22, RNSkia Present 19, mali-cmar-backe 13 | 139.0 | 102.2 | 4.7 |
| tgfx · paths900 · texture | 10 | 2 | TgfxRender 53, RenderThread 17, mali-cmar-backe 9 | 191.2 | 112.8 | 4.4 |
| skia · paths900 · texture | 9 | 2 | RNSkia Render 12, RNSkia Present 8, RenderThread 8 | 244.8 | 103.7 | 4.5 |
| tgfx · paths2500 · texture | 10 | 2 | TgfxRender 95, RenderThread 14, mali-cmar-backe 7 | 275.2 | 123.7 | 4.4 |
| skia · paths2500 · texture | 8 | 2 | RNSkia Render 25, RNSkia Present 7, RenderThread 7 | 249.5 | 105.5 | 4.5 |
| tgfx · paths5000 · texture | 8 | 1 | TgfxRender 97, RenderThread 6, binder 5 | 290.4 | 142.8 | 4.4 |
| skia · paths5000 · texture | 8 | 2 | RNSkia Render 25, mali-cmar-backe 5, RNSkia Present 5 | 255.8 | 110.0 | 4.5 |
| tgfx · paths · texture | 7 | 1 | TgfxRender 101, binder 4, RenderThread 3 | 335.7 | 175.2 | 4.4 |
| skia · paths · texture | 10 | 2 | RNSkia Render 21, mali-cmar-backe 4, binder 3 | 276.5 | 110.6 | 4.4 |
| tgfx · text · texture | 9 | 1 | TgfxRender 108, RenderThread 11, nitro-thread 9 | 185.7 | 129.2 | 4.4 |
| skia · text · texture | 6 | 1 | RNSkia Render 93, RNSkia Present 16, RenderThread 5 | 223.0 | 118.3 | 4.5 |
| tgfx · anim-decl · texture | 94 | 0 | TgfxRender 96, nitro-thread 10, binder 5 | 186.6 | 189.4 | 4.4 |
| skia · anim-decl · texture | 98 | 0 | RNSkia Render 8, RNSkia Present 4, binder 3 | 148.7 | 177.9 | 4.4 |
| skia · anim-imp · texture | 96 | 1 | RNSkia Render 12, RNSkia Present 9, RenderThread 4 | 173.4 | 123.2 | 4.5 |
| tgfx · shapes-picture · texture | 10 | 2 | TgfxRender 123, nitro-thread 15, RenderThread 12 | 195.4 | 144.2 | 4.4 |
| skia · shapes-picture · texture | 8 | 2 | RNSkia Render 43, RNSkia Present 25, mali-cmar-backe 5 | 271.5 | 113.4 | 4.5 |

## tgfx anim-imp, clock from scene attach

`node bench/run.mjs --engines tgfx,skia --scenes anim-imp --order alternate --reps 2 --gap 10 --cool 0.95 --cool-timeout 240`

Per-window present FPS: tgfx surface 13.9, 12.5, 14.1, 13.4; skia surface 64.3, 54.6; tgfx texture 4.8, 4.5, 5.3, 6.8; skia texture 24.6, 20.0, 24.0, 20.6.

| engine · scene · view | Present FPS | UI FPS | JS FPS | CPU % (1 core = 100) | PSS MB | thermal | CPU cap % | ticks |
|---|---|---|---|---|---|---|---|---|
| tgfx · anim-imp · surface | 13.6 | 14 | 7 | 176 | 1118.8 | 1 | 68 | 69 |
| skia · anim-imp · surface | 59.4 | 74 | 37 | 158 | 344.9 | 1 | 72 | 52 |
| tgfx · anim-imp · texture | 5.0 | 15 | 7 | 172 | 1146.6 | 1 | 72 | 66 |
| skia · anim-imp · texture | 22.3 | 77 | 39 | 129 | 387.9 | 2 | 84 | 52 |

### Where the CPU and memory go

| engine · scene · view | UI thread % | JS thread % | busiest other threads % | Graphics MB | Native MB | Java MB |
|---|---|---|---|---|---|---|
| tgfx · anim-imp · surface | 98 | 0 | TgfxRender 66, nitro-thread 8, binder 5 | 159.2 | 565.3 | 6.2 |
| skia · anim-imp · surface | 95 | 1 | RNSkia Render 29, RNSkia Present 25, binder 5 | 134.7 | 123.0 | 6.9 |
| tgfx · anim-imp · texture | 98 | 0 | TgfxRender 61, nitro-thread 5, binder 4 | 186.6 | 565.1 | 6.7 |
| skia · anim-imp · texture | 97 | 1 | RNSkia Render 12, RNSkia Present 9, RenderThread 4 | 173.4 | 124.3 | 6.8 |
