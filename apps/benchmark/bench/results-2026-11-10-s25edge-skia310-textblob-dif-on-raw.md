# tgfx vs skia bench (complete)

| engine · scene · view | Present FPS | UI FPS | JS FPS | CPU % (1 core = 100) | PSS MB | thermal | CPU cap % | ticks |
|---|---|---|---|---|---|---|---|---|
| skia · text · surface | 85.1 | 120 | 120 | 134 | 533.8 | 0 | 64 | 53 |

`thermal` is the highest Android thermal status (0 none … 3 severe) seen at the start of the combo's runs. `CPU cap %` is the lowest scaling_max_freq / cpuinfo_max_freq seen during them: below 100 the kernel was throttling, whatever the status says.

## Where the CPU and memory go

| engine · scene · view | UI thread % | JS thread % | busiest other threads % | Graphics MB | Native MB | Java MB |
|---|---|---|---|---|---|---|
| skia · text · surface | 3 | 1 | RNSkia Render 80, RNSkia Present 43, binder 3 | 238.5 | 123.6 | 4.9 |
