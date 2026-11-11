# Raw: Pixel 8, 120 Hz, react-native-skia 3.10.0

`node bench/run.mjs --order alternate --reps 2 --gap 10 --cool 0.95 --cool-timeout 240 --skip tgfx:anim-imp --views <view>`, once per view.

## SurfaceView

| engine · scene · view | Present FPS | UI FPS | JS FPS | CPU % (1 core = 100) | PSS MB | thermal | CPU cap % | ticks |
|---|---|---|---|---|---|---|---|---|
| tgfx · shapes · surface | 116.3 | 120 | 120 | 329 | 489.1 | 1 | 91 | 53 |
| skia · shapes · surface | 118.3 | 120 | 119 | 109 | 396.9 | 1 | 98 | 53 |
| tgfx · shapes-nodes · surface | 116.8 | 120 | 120 | 332 | 490.1 | 1 | 91 | 52 |
| skia · shapes-nodes · surface | 54.9 | 120 | 119 | 173 | 484.2 | 1 | 92 | 53 |
| tgfx · shapes-atlas · surface | 118.8 | 120 | 119 | 64 | 468.5 | 1 | 98 | 53 |
| skia · shapes-atlas · surface | 118.6 | 120 | 119 | 112 | 396.5 | 1 | 100 | 53 |
| tgfx · images · surface | 119.0 | 120 | 120 | 166 | 431.2 | 1 | 100 | 53 |
| skia · images · surface | 111.6 | 120 | 119 | 170 | 416.3 | 1 | 100 | 53 |
| tgfx · shader · surface | 117.2 | 120 | 119 | 62 | 414.0 | 1 | 100 | 51 |
| skia · shader · surface | 49.5 | 120 | 119 | 57 | 375.1 | 1 | 100 | 53 |
| tgfx · pattern · surface | 119.1 | 120 | 119 | 62 | 412.5 | 1 | 100 | 53 |
| skia · pattern · surface | 117.8 | 120 | 119 | 81 | 377.4 | 1 | 100 | 53 |
| tgfx · paths900 · surface | 118.9 | 120 | 119 | 107 | 465.7 | 1 | 100 | 53 |
| skia · paths900 · surface | 118.4 | 120 | 119 | 122 | 376.6 | 1 | 100 | 52 |
| tgfx · paths2500 · surface | 103.7 | 120 | 119 | 127 | 509.6 | 1 | 88 | 53 |
| skia · paths2500 · surface | 118.3 | 120 | 119 | 138 | 383.6 | 1 | 98 | 53 |
| tgfx · paths5000 · surface | 46.8 | 120 | 119 | 126 | 612.4 | 1 | 88 | 53 |
| skia · paths5000 · surface | 117.6 | 120 | 120 | 152 | 394.7 | 1 | 92 | 53 |
| tgfx · paths · surface | 21.0 | 120 | 119 | 123 | 650.8 | 1 | 88 | 53 |
| skia · paths · surface | 75.4 | 120 | 119 | 154 | 410.4 | 1 | 79 | 53 |
| tgfx · text · surface | 84.8 | 120 | 119 | 231 | 463.5 | 1 | 79 | 53 |
| skia · text · surface | 41.8 | 120 | 119 | 163 | 470.7 | 1 | 88 | 52 |
| tgfx · anim-decl · surface | 23.9 | 44 | 22 | 280 | 613.2 | 1 | 74 | 51 |
| skia · anim-decl · surface | 45.8 | 45 | 23 | 213 | 586.3 | 1 | 74 | 51 |
| skia · anim-imp · surface | 100.7 | 98 | 49 | 234 | 439.2 | 1 | 88 | 51 |
| tgfx · shapes-picture · surface | 115.0 | 120 | 120 | 292 | 492.0 | 1 | 91 | 53 |
| skia · shapes-picture · surface | 63.3 | 120 | 119 | 168 | 482.3 | 1 | 92 | 53 |

`thermal` is the highest Android thermal status (0 none … 3 severe) seen at the start of the combo's runs. `CPU cap %` is the lowest scaling_max_freq / cpuinfo_max_freq seen during them: below 100 the kernel was throttling, whatever the status says.

### Where the CPU and memory go

| engine · scene · view | UI thread % | JS thread % | busiest other threads % | Graphics MB | Native MB | Java MB |
|---|---|---|---|---|---|---|
| tgfx · shapes · surface | 12 | 3 | TgfxRender 250, nitro-thread 47, binder 9 | 250.1 | 138.9 | 5.2 |
| skia · shapes · surface | 13 | 3 | RNSkia Render 38, RNSkia Present 31, binder 12 | 192.3 | 110.2 | 5.6 |
| tgfx · shapes-nodes · surface | 13 | 3 | TgfxRender 249, nitro-thread 47, binder 9 | 250.2 | 139.0 | 5.2 |
| skia · shapes-nodes · surface | 14 | 3 | RNSkia Render 91, RNSkia Present 53, binder 8 | 259.9 | 114.7 | 5.4 |
| tgfx · shapes-atlas · surface | 13 | 3 | TgfxRender 25, binder 13, mali-event-hand 5 | 234.4 | 122.9 | 5.2 |
| skia · shapes-atlas · surface | 13 | 4 | RNSkia Render 40, RNSkia Present 32, binder 13 | 192.4 | 109.7 | 5.6 |
| tgfx · images · surface | 13 | 3 | TgfxRender 114, nitro-thread 15, binder 7 | 228.3 | 109.5 | 5.2 |
| skia · images · surface | 14 | 3 | RNSkia Render 74, RNSkia Present 56, binder 11 | 212.7 | 106.4 | 5.6 |
| tgfx · shader · surface | 13 | 3 | TgfxRender 25, binder 13, mali-event-hand 5 | 219.7 | 103.2 | 5.2 |
| skia · shader · surface | 16 | 4 | RNSkia Present 18, binder 9, RNSkia Render 5 | 175.3 | 104.3 | 5.4 |
| tgfx · pattern · surface | 14 | 3 | TgfxRender 26, binder 13, mali-event-hand 5 | 219.7 | 103.2 | 5.2 |
| skia · pattern · surface | 13 | 4 | RNSkia Present 32, binder 13, RNSkia Render 10 | 181.5 | 102.0 | 5.6 |
| tgfx · paths900 · surface | 13 | 3 | TgfxRender 76, binder 8, mali-event-hand 4 | 260.0 | 112.6 | 5.2 |
| skia · paths900 · surface | 13 | 3 | RNSkia Render 54, RNSkia Present 29, binder 12 | 178.3 | 103.3 | 5.6 |
| tgfx · paths2500 · surface | 12 | 3 | TgfxRender 96, binder 9, mali-event-hand 4 | 285.4 | 129.4 | 5.2 |
| skia · paths2500 · surface | 13 | 3 | RNSkia Render 74, RNSkia Present 30, binder 10 | 183.3 | 105.7 | 5.6 |
| tgfx · paths5000 · surface | 12 | 3 | TgfxRender 102, binder 9, GPU completion 2 | 360.7 | 153.3 | 5.2 |
| skia · paths5000 · surface | 12 | 3 | RNSkia Render 85, RNSkia Present 32, binder 10 | 187.4 | 108.9 | 5.6 |
| tgfx · paths · surface | 13 | 3 | TgfxRender 106, binder 6, nitro-thread 2 | 364.9 | 187.0 | 5.2 |
| skia · paths · surface | 12 | 3 | RNSkia Render 96, RNSkia Present 26, binder 9 | 193.6 | 114.8 | 5.5 |
| tgfx · text · surface | 12 | 3 | TgfxRender 157, nitro-thread 42, binder 9 | 238.8 | 128.0 | 5.2 |
| skia · text · surface | 13 | 3 | RNSkia Render 97, RNSkia Present 38, binder 6 | 257.9 | 112.4 | 5.4 |
| tgfx · anim-decl · surface | 99 | 1 | TgfxRender 145, nitro-thread 26, binder 4 | 242.1 | 200.5 | 5.2 |
| skia · anim-decl · surface | 99 | 1 | RNSkia Render 65, RNSkia Present 40, binder 5 | 229.7 | 185.1 | 5.4 |
| skia · anim-imp · surface | 98 | 2 | RNSkia Render 72, RNSkia Present 38, binder 9 | 229.8 | 115.7 | 5.6 |
| tgfx · shapes-picture · surface | 14 | 3 | TgfxRender 211, nitro-thread 38, binder 8 | 250.2 | 141.6 | 5.2 |
| skia · shapes-picture · surface | 14 | 4 | RNSkia Render 83, RNSkia Present 58, binder 8 | 280.6 | 108.5 | 5.4 |

## TextureView

| engine · scene · view | Present FPS | UI FPS | JS FPS | CPU % (1 core = 100) | PSS MB | thermal | CPU cap % | ticks |
|---|---|---|---|---|---|---|---|---|
| tgfx · shapes · texture | 90.1 | 120 | 120 | 341 | 485.9 | 1 | 90 | 53 |
| skia · shapes · texture | 116.9 | 120 | 120 | 141 | 410.2 | 1 | 98 | 53 |
| tgfx · shapes-nodes · texture | 87.9 | 120 | 120 | 344 | 488.0 | 1 | 91 | 53 |
| skia · shapes-nodes · texture | 53.4 | 120 | 119 | 192 | 499.3 | 1 | 92 | 53 |
| tgfx · shapes-atlas · texture | 115.6 | 119 | 119 | 86 | 473.4 | 1 | 98 | 52 |
| skia · shapes-atlas · texture | 117.0 | 120 | 120 | 137 | 410.5 | 1 | 100 | 53 |
| tgfx · images · texture | 108.0 | 120 | 120 | 193 | 436.1 | 1 | 100 | 53 |
| skia · images · texture | 85.1 | 120 | 120 | 173 | 425.2 | 1 | 100 | 53 |
| tgfx · shader · texture | 96.3 | 120 | 60 | 82 | 431.1 | 1 | 100 | 53 |
| skia · shader · texture | 47.9 | 120 | 119 | 66 | 392.9 | 1 | 100 | 52 |
| tgfx · pattern · texture | 115.1 | 119 | 120 | 83 | 425.4 | 1 | 100 | 53 |
| skia · pattern · texture | 116.3 | 120 | 120 | 111 | 394.6 | 1 | 100 | 53 |
| tgfx · paths900 · texture | 102.3 | 120 | 119 | 131 | 463.7 | 1 | 100 | 52 |
| skia · paths900 · texture | 116.8 | 120 | 120 | 148 | 390.7 | 1 | 100 | 52 |
| tgfx · paths2500 · texture | 96.5 | 120 | 120 | 158 | 501.1 | 1 | 88 | 52 |
| skia · paths2500 · texture | 115.9 | 120 | 119 | 163 | 398.2 | 1 | 98 | 53 |
| tgfx · paths5000 · texture | 46.6 | 120 | 119 | 143 | 615.8 | 1 | 88 | 53 |
| skia · paths5000 · texture | 115.4 | 120 | 120 | 179 | 408.7 | 1 | 98 | 53 |
| tgfx · paths · texture | 20.9 | 120 | 119 | 131 | 707.7 | 1 | 92 | 53 |
| skia · paths · texture | 76.4 | 120 | 120 | 174 | 423.0 | 1 | 92 | 53 |
| tgfx · text · texture | 81.8 | 120 | 119 | 245 | 467.6 | 1 | 88 | 53 |
| skia · text · texture | 41.4 | 120 | 120 | 175 | 478.9 | 1 | 88 | 53 |
| tgfx · anim-decl · texture | 4.0 | 49 | 25 | 133 | 616.1 | 1 | 92 | 51 |
| skia · anim-decl · texture | 11.9 | 47 | 24 | 143 | 586.7 | 1 | 92 | 51 |
| skia · anim-imp · texture | 25.3 | 103 | 51 | 173 | 443.0 | 1 | 92 | 52 |
| tgfx · shapes-picture · texture | 84.4 | 120 | 120 | 303 | 488.0 | 1 | 95 | 53 |
| skia · shapes-picture · texture | 61.0 | 120 | 120 | 184 | 483.8 | 1 | 100 | 53 |

`thermal` is the highest Android thermal status (0 none … 3 severe) seen at the start of the combo's runs. `CPU cap %` is the lowest scaling_max_freq / cpuinfo_max_freq seen during them: below 100 the kernel was throttling, whatever the status says.

### Where the CPU and memory go

| engine · scene · view | UI thread % | JS thread % | busiest other threads % | Graphics MB | Native MB | Java MB |
|---|---|---|---|---|---|---|
| tgfx · shapes · texture | 17 | 3 | TgfxRender 243, nitro-thread 44, RenderThread 18 | 245.2 | 140.2 | 5.2 |
| skia · shapes · texture | 19 | 3 | RNSkia Render 37, RNSkia Present 25, RenderThread 25 | 205.3 | 111.1 | 5.6 |
| tgfx · shapes-nodes · texture | 17 | 3 | TgfxRender 232, nitro-thread 43, RenderThread 18 | 247.3 | 140.3 | 5.2 |
| skia · shapes-nodes · texture | 17 | 3 | RNSkia Render 93, RNSkia Present 50, RenderThread 14 | 271.9 | 116.8 | 5.4 |
| tgfx · shapes-atlas · texture | 18 | 3 | RenderThread 23, TgfxRender 20, mali-event-hand 11 | 238.2 | 124.2 | 5.2 |
| skia · shapes-atlas · texture | 20 | 3 | RNSkia Render 36, RenderThread 26, RNSkia Present 25 | 205.7 | 111.3 | 5.6 |
| tgfx · images · texture | 17 | 3 | TgfxRender 117, RenderThread 22, nitro-thread 14 | 231.2 | 110.9 | 5.2 |
| skia · images · texture | 18 | 3 | RNSkia Render 68, RNSkia Present 46, RenderThread 19 | 219.3 | 108.0 | 5.5 |
| tgfx · shader · texture | 17 | 2 | RenderThread 23, TgfxRender 18, mali-event-hand 11 | 232.4 | 105.9 | 5.2 |
| skia · shader · texture | 18 | 4 | RenderThread 13, RNSkia Present 11, binder 8 | 190.8 | 107.5 | 5.4 |
| tgfx · pattern · texture | 17 | 3 | RenderThread 21, TgfxRender 20, mali-event-hand 11 | 229.4 | 104.2 | 5.2 |
| skia · pattern · texture | 20 | 3 | RenderThread 27, RNSkia Present 25, mali-event-hand 12 | 194.6 | 105.7 | 5.6 |
| tgfx · paths900 · texture | 16 | 3 | TgfxRender 72, RenderThread 19, binder 9 | 255.8 | 114.1 | 5.2 |
| skia · paths900 · texture | 17 | 3 | RNSkia Render 50, RNSkia Present 26, RenderThread 22 | 191.2 | 104.3 | 5.6 |
| tgfx · paths2500 · texture | 16 | 3 | TgfxRender 101, RenderThread 19, binder 9 | 275.1 | 130.5 | 5.2 |
| skia · paths2500 · texture | 19 | 3 | RNSkia Render 72, RNSkia Present 27, RenderThread 24 | 194.5 | 106.8 | 5.6 |
| tgfx · paths5000 · texture | 14 | 3 | TgfxRender 100, RenderThread 12, binder 6 | 364.7 | 155.1 | 5.2 |
| skia · paths5000 · texture | 19 | 3 | RNSkia Render 87, RNSkia Present 29, RenderThread 26 | 200.6 | 110.2 | 5.6 |
| tgfx · paths · texture | 14 | 3 | TgfxRender 99, RenderThread 6, binder 6 | 405.9 | 200.7 | 5.2 |
| skia · paths · texture | 14 | 3 | RNSkia Render 97, RNSkia Present 22, RenderThread 15 | 203.5 | 115.7 | 5.5 |
| tgfx · text · texture | 14 | 3 | TgfxRender 160, nitro-thread 38, RenderThread 16 | 242.0 | 129.3 | 5.2 |
| skia · text · texture | 13 | 3 | RNSkia Render 96, RNSkia Present 38, RenderThread 9 | 266.7 | 113.4 | 5.3 |
| tgfx · anim-decl · texture | 96 | 1 | TgfxRender 37, nitro-thread 7, binder 3 | 244.5 | 200.9 | 5.2 |
| skia · anim-decl · texture | 97 | 1 | RNSkia Render 22, RNSkia Present 15, binder 4 | 229.0 | 186.0 | 5.2 |
| skia · anim-imp · texture | 96 | 2 | RNSkia Render 28, RNSkia Present 25, hades 8 | 232.1 | 117.1 | 5.3 |
| tgfx · shapes-picture · texture | 17 | 3 | TgfxRender 213, nitro-thread 38, RenderThread 18 | 245.2 | 142.4 | 5.2 |
| skia · shapes-picture · texture | 15 | 3 | RNSkia Render 80, RNSkia Present 53, RenderThread 15 | 278.5 | 110.4 | 5.4 |
