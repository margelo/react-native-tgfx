# tgfx vs skia bench (complete)

| engine · scene · view | Present FPS | UI FPS | JS FPS | CPU % (1 core = 100) | PSS MB | thermal | CPU cap % | ticks |
|---|---|---|---|---|---|---|---|---|
| skia · text · surface | 97.4 | 120 | 120 | 142 | 484.9 | 0 | 100 | 53 |
| skia · text · texture | 107.0 | 120 | 119 | 159 | 529.6 | 0 | 55 | 53 |

`thermal` is the highest Android thermal status (0 none … 3 severe) seen at the start of the combo's runs. `CPU cap %` is the lowest scaling_max_freq / cpuinfo_max_freq seen during them: below 100 the kernel was throttling, whatever the status says.

## Where the CPU and memory go

| engine · scene · view | UI thread % | JS thread % | busiest other threads % | Graphics MB | Native MB | Java MB |
|---|---|---|---|---|---|---|
| skia · text · surface | 3 | 1 | RNSkia Render 83, RNSkia Present 48, binder 4 | 215.4 | 125.0 | 8.6 |
| skia · text · texture | 4 | 1 | RNSkia Render 96, RNSkia Present 49, RenderThread 8 | 264.0 | 125.7 | 5.0 |
