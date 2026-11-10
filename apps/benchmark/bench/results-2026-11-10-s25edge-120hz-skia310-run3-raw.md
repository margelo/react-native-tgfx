# tgfx vs skia bench (complete)

| engine · scene · view | Present FPS | UI FPS | JS FPS | CPU % (1 core = 100) | PSS MB | thermal | CPU cap % | ticks |
|---|---|---|---|---|---|---|---|---|
| tgfx · shapes · surface | 89.9 | 120 | 120 | 227 | 473.7 | 0 | 96 | 25 |
| skia · shapes · surface | 119.4 | 120 | 120 | 55 | 380.8 | 0 | 100 | 25 |
| tgfx · images · surface | 119.4 | 120 | 119 | 71 | 403.3 | 0 | 96 | 25 |
| skia · images · surface | 119.0 | 120 | 120 | 93 | 434.8 | 0 | 100 | 25 |
| tgfx · shader · surface | 119.6 | 120 | 120 | 43 | 390.3 | 0 | 100 | 25 |
| skia · shader · surface | 119.3 | 119 | 119 | 36 | 352.9 | 0 | 91 | 25 |
| tgfx · pattern · surface | 119.6 | 120 | 120 | 44 | 391.4 | 0 | 100 | 25 |
| skia · pattern · surface | 119.3 | 120 | 120 | 37 | 348.7 | 0 | 100 | 25 |
| tgfx · paths · surface | 11.6 | 119 | 119 | 193 | 1026.8 | 0 | 55 | 25 |
| skia · paths · surface | 115.2 | 119 | 119 | 115 | 471.3 | 0 | 73 | 25 |
| tgfx · text · surface | 117.1 | 120 | 120 | 146 | 462.4 | 0 | 64 | 25 |
| skia · text · surface | 92.8 | 120 | 120 | 145 | 521.0 | 0 | 91 | 25 |
| tgfx · anim-decl · surface | 35.2 | 68 | 35 | 300 | 613.4 | 0 | 69 | 24 |
| skia · anim-decl · surface | 75.4 | 74 | 37 | 190 | 552.0 | 0 | 73 | 25 |
| skia · anim-imp · surface | 118.6 | 119 | 103 | 168 | 408.1 | 0 | 86 | 25 |
| tgfx · shapes-picture · surface | 114.4 | 120 | 119 | 193 | 475.0 | 0 | 73 | 25 |
| skia · shapes-picture · surface | 104.6 | 120 | 120 | 133 | 505.4 | 0 | 86 | 25 |
| tgfx · shapes · texture | 86.9 | 120 | 120 | 239 | 526.5 | 0 | 59 | 25 |
| skia · shapes · texture | 119.3 | 120 | 120 | 65 | 424.9 | 0 | 100 | 25 |
| tgfx · images · texture | 118.8 | 120 | 120 | 83 | 454.2 | 0 | 100 | 25 |
| skia · images · texture | 118.8 | 120 | 120 | 100 | 482.7 | 0 | 91 | 25 |
| tgfx · shader · texture | 119.0 | 119 | 119 | 58 | 445.0 | 0 | 96 | 25 |
| skia · shader · texture | 119.0 | 119 | 119 | 53 | 403.8 | 0 | 100 | 25 |
| tgfx · pattern · texture | 118.8 | 119 | 119 | 61 | 444.3 | 0 | 100 | 25 |
| skia · pattern · texture | 119.4 | 120 | 120 | 53 | 397.2 | 0 | 100 | 25 |
| tgfx · paths · texture | 17.1 | 120 | 119 | 171 | 1070.0 | 0 | 55 | 25 |
| skia · paths · texture | 116.8 | 119 | 119 | 130 | 523.8 | 0 | 86 | 25 |
| tgfx · text · texture | 112.6 | 120 | 119 | 178 | 513.8 | 0 | 69 | 25 |
| skia · text · texture | 83.4 | 120 | 120 | 151 | 560.8 | 0 | 50 | 25 |
| tgfx · anim-decl · texture | 22.1 | 69 | 35 | 297 | 662.0 | 0 | 64 | 24 |
| skia · anim-decl · texture | 21.5 | 78 | 40 | 134 | 590.1 | 0 | 86 | 24 |
| skia · anim-imp · texture | 55.1 | 117 | 95 | 162 | 458.4 | 0 | 100 | 25 |
| tgfx · shapes-picture · texture | 110.9 | 120 | 120 | 197 | 529.5 | 0 | 86 | 25 |
| skia · shapes-picture · texture | 108.8 | 120 | 120 | 145 | 556.4 | 0 | 79 | 25 |

`thermal` is the highest Android thermal status (0 none … 3 severe) seen at the start of the combo's runs. `CPU cap %` is the lowest scaling_max_freq / cpuinfo_max_freq seen during them: below 100 the kernel was throttling, whatever the status says.

## Where the CPU and memory go

| engine · scene · view | UI thread % | JS thread % | busiest other threads % | Graphics MB | Native MB | Java MB |
|---|---|---|---|---|---|---|
| tgfx · shapes · surface | 2 | 0 | TgfxRender 188, nitro-thread 31, binder 3 | 207.5 | 146.7 | 6.6 |
| skia · shapes · surface | 4 | 1 | RNSkia Render 22, RNSkia Present 18, binder 6 | 166.2 | 108.7 | 8.6 |
| tgfx · images · surface | 3 | 1 | TgfxRender 56, binder 4, nitro-thread 3 | 205.6 | 108.2 | 6.6 |
| skia · images · surface | 2 | 0 | RNSkia Render 59, RNSkia Present 27, binder 3 | 195.8 | 110.4 | 8.6 |
| tgfx · shader · surface | 5 | 1 | TgfxRender 30, binder 6 | 205.4 | 102.1 | 4.6 |
| skia · shader · surface | 5 | 1 | RNSkia Present 19, binder 6, RNSkia Render 3 | 159.9 | 103.9 | 8.6 |
| tgfx · pattern · surface | 5 | 1 | TgfxRender 29, binder 5 | 205.8 | 101.6 | 4.6 |
| skia · pattern · surface | 5 | 1 | RNSkia Present 19, RNSkia Render 4, binder 3 | 155.2 | 104.0 | 8.6 |
| tgfx · paths · surface | 2 | 0 | TgfxRender 157, nitro-thread 20, binder 3 | 448.7 | 351.0 | 6.6 |
| skia · paths · surface | 5 | 1 | RNSkia Render 78, RNSkia Present 25, binder 5 | 252.8 | 114.1 | 5.0 |
| tgfx · text · surface | 3 | 1 | TgfxRender 128, nitro-thread 18, binder 4 | 236.1 | 125.9 | 6.6 |
| skia · text · surface | 2 | 1 | RNSkia Render 93, RNSkia Present 43, binder 4 | 238.4 | 119.1 | 4.9 |
| tgfx · anim-decl · surface | 99 | 0 | TgfxRender 174, nitro-thread 25, binder 2 | 209.2 | 221.1 | 6.5 |
| skia · anim-decl · surface | 99 | 0 | RNSkia Render 62, RNSkia Present 23, binder 3 | 180.1 | 188.6 | 4.9 |
| skia · anim-imp · surface | 79 | 1 | RNSkia Render 51, RNSkia Present 26, binder 3 | 180.0 | 119.8 | 8.6 |
| tgfx · shapes-picture · surface | 2 | 1 | TgfxRender 155, nitro-thread 24, binder 3 | 207.5 | 149.2 | 4.6 |
| skia · shapes-picture · surface | 2 | 0 | RNSkia Render 81, RNSkia Present 48, binder 3 | 230.8 | 113.5 | 8.6 |
| tgfx · shapes · texture | 3 | 1 | TgfxRender 192, nitro-thread 32, RenderThread 5 | 258.6 | 147.2 | 6.6 |
| skia · shapes · texture | 7 | 1 | RNSkia Render 20, RenderThread 16, RNSkia Present 12 | 216.3 | 109.4 | 8.6 |
| tgfx · images · texture | 5 | 1 | TgfxRender 57, RenderThread 10, binder 4 | 255.7 | 108.7 | 6.6 |
| skia · images · texture | 3 | 1 | RNSkia Render 59, RNSkia Present 26, RenderThread 7 | 244.3 | 111.7 | 8.6 |
| tgfx · shader · texture | 7 | 1 | TgfxRender 27, RenderThread 15, binder 6 | 256.2 | 102.5 | 6.6 |
| skia · shader · texture | 8 | 1 | RenderThread 19, RNSkia Present 14, binder 5 | 210.8 | 105.1 | 6.9 |
| tgfx · pattern · texture | 7 | 1 | TgfxRender 28, RenderThread 16, binder 6 | 256.1 | 102.7 | 6.6 |
| skia · pattern · texture | 8 | 1 | RenderThread 18, RNSkia Present 13, binder 7 | 206.0 | 105.1 | 5.1 |
| tgfx · paths · texture | 2 | 1 | TgfxRender 148, nitro-thread 17, binder 2 | 499.1 | 348.3 | 4.6 |
| skia · paths · texture | 7 | 1 | RNSkia Render 77, RNSkia Present 20, RenderThread 16 | 303.8 | 115.4 | 5.0 |
| tgfx · text · texture | 4 | 1 | TgfxRender 128, nitro-thread 18, RenderThread 10 | 286.8 | 126.8 | 6.6 |
| skia · text · texture | 4 | 1 | RNSkia Render 100, RNSkia Present 45, RenderThread 8 | 281.7 | 120.6 | 6.8 |
| tgfx · anim-decl · texture | 98 | 0 | TgfxRender 163, nitro-thread 26, RenderThread 2 | 260.1 | 221.5 | 4.5 |
| skia · anim-decl · texture | 98 | 0 | RNSkia Render 23, RNSkia Present 8, binder 4 | 222.7 | 188.5 | 4.6 |
| skia · anim-imp · texture | 79 | 1 | RNSkia Render 45, RNSkia Present 22, RenderThread 6 | 231.2 | 120.5 | 6.6 |
| tgfx · shapes-picture · texture | 3 | 1 | TgfxRender 151, nitro-thread 24, RenderThread 6 | 258.6 | 149.8 | 6.6 |
| skia · shapes-picture · texture | 3 | 1 | RNSkia Render 80, RNSkia Present 49, RenderThread 7 | 281.3 | 114.3 | 8.6 |
