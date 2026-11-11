# tgfx vs skia bench (complete)

| engine · scene · view | Present FPS | UI FPS | JS FPS | CPU % (1 core = 100) | PSS MB | thermal | CPU cap % | ticks |
|---|---|---|---|---|---|---|---|---|
| skia · text · surface | 74.3 | 119 | 119 | 138 | 510.1 | 0 | 50 | 53 |
| skia · text · texture | 86.1 | 120 | 120 | 154 | 558.9 | 0 | 44 | 53 |

`thermal` is the highest Android thermal status (0 none … 3 severe) seen at the start of the combo's runs. `CPU cap %` is the lowest scaling_max_freq / cpuinfo_max_freq seen during them: below 100 the kernel was throttling, whatever the status says.

## Where the CPU and memory go

| engine · scene · view | UI thread % | JS thread % | busiest other threads % | Graphics MB | Native MB | Java MB |
|---|---|---|---|---|---|---|
| skia · text · surface | 3 | 1 | RNSkia Render 96, RNSkia Present 36, binder 4 | 230.5 | 119.5 | 6.6 |
| skia · text · texture | 4 | 1 | RNSkia Render 98, RNSkia Present 45, RenderThread 8 | 281.6 | 120.2 | 5.0 |
