# react-native-tgfx

A **declarative, Skia-style GPU 2D canvas** for React Native, backed by Tencent's
[**tgfx**](https://github.com/Tencent/tgfx) and built with
[**Nitro Modules**](https://nitro.margelo.com).

Render shapes, strokes, paths, gradients, images and text through React
components or an imperative `Scene` API. Both compile to a native draw program
that runs on the GPU: Metal on iOS, Vulkan by default on Android, or OpenGL ES
with a build-time opt-in.

Currently an alpha release. See the [documentation](../../docs/content/docs)
for animation, runtime shaders, camera frames, effects and offscreen export.

## Install

```bash
npm install react-native-tgfx@alpha react-native-nitro-modules
```

Animation, camera and video also need `react-native-reanimated` and
`react-native-worklets`.

Rebuild the native app after installing. On iOS, install the pods first:

```bash
cd ios && pod install
```

## Draw

```tsx
import { Canvas, Rect, Circle, Path, Image, Text, LinearGradient, useImage } from 'react-native-tgfx'

function Hello() {
  const img = useImage(require('./cat.png'))
  return (
    <Canvas style={{ flex: 1 }}>
      <Rect x={0} y={0} width={120} height={80} color="lightblue" />

      <Circle cx={160} cy={120} r={40} color="red" style="stroke" strokeWidth={6} strokeCap="round" />

      <Path path="M0 200 q40 -60 80 0 t80 0" color="#5856D6" style="stroke" strokeWidth={5} />

      <Rect x={0} y={260} width={160} height={70}>
        <LinearGradient start={{ x: 0, y: 260 }} end={{ x: 160, y: 330 }} colors={['#FF6CAB', '#7366FF']} />
      </Rect>

      {img && <Image x={180} y={260} width={96} height={96} image={img} fit="cover" />}

      <Text x={0} y={380} text="Hello tgfx" fontSize={24} color="#111" />
    </Canvas>
  )
}
```

## How it works

```
<Canvas> children / imperative Scene nodes
   ▼
scene compiler
   ▼
binary Float64Array program + string-table delta
   │  setScene() — direct Nitro hybrid-object call
   ▼
shared C++ renderer → tgfx::Canvas
   │  dedicated render thread / serial render queue
   ▼
Metal (iOS) / Vulkan or OpenGL ES (Android) → GPU
```

- Plain drawing elements use a direct-node fast path; trees with custom
  components use a persistence-mode `react-reconciler`. Both feed the same
  scene compiler as the imperative `Scene` API.
- Scene commits send a binary program and a string-table delta through
  `setScene()`, without a scene prop or a Fabric shadow-tree commit. Native
  code compiles the program once per scene change and replays it when dirty.
- Reanimated shared values and imperative node handles update live slots
  without React renders or re-uploading the scene. Props without slots fall
  back to re-encoding. See [Animation](../../docs/content/docs/animation.mdx)
  and [Imperative](../../docs/content/docs/imperative.mdx).
- Drawing runs on Android's dedicated `TgfxRender` thread and an iOS serial
  render queue. Idle canvases suspend rendering until something changes.
- iOS hosts a `CAMetalLayer`. Android uses a `SurfaceView` by default; set
  `composite="texture"` for a `TextureView` inside the view hierarchy.

### Android rendering backend

Vulkan is the default. To build with OpenGL ES instead, add this to your app's
`android/gradle.properties` and rebuild:

```properties
TgfxVulkan=OFF
```

## Components

| Component | Key props |
|---|---|
| `Canvas` | `style`, `children` |
| `Group` | `transform`, `origin`, `opacity` + inherited paint |
| `Rect` / `Oval` | `x`, `y`, `width`, `height` |
| `RoundedRect` | `x`, `y`, `width`, `height`, `r` (or `rx`/`ry`) |
| `Circle` | `cx`, `cy`, `r` |
| `Line` | `x1`, `y1`, `x2`, `y2` |
| `Path` | `path` (SVG path data) |
| `Image` | `x`, `y`, `width`, `height`, `image` (a `useImage` handle), `fit`, `sampling`, `rect` |
| `Text` | `x`, `y`, `text`, `fontSize`, `fontFamily` |
| `Paint` | paint as a child of a shape/group |
| `LinearGradient` / `RadialGradient` | shader as a child of a shape/`Paint` |

**Paint props** (on any drawing component, `Group`, or `Paint`): `color`,
`style` (`'fill'` \| `'stroke'`), `strokeWidth`, `strokeCap`, `strokeJoin`,
`opacity`, `antiAlias`.

Colors accept hex (`'#rrggbb'`, `'#rgba'`), `rgb()/rgba()`, common names, or a
packed `0xAARRGGBB` number.

## Hooks

- `useImageState(source)` — the same load as `useImage`, returning `{ data, error, loading }` so a slow load can be told from a failed one
- `useImage(source)` — loads a `require()` asset, URL, `data:` URI, or base64
  string into a native `TgfxImage` handle. Local files are decoded natively and
  their bytes never enter JS; nothing is base64-encoded on the JS thread.
- `useVideo(source, { seek, paused, looping, volume })` — plays a video into a
  drawable handle: `{ currentFrame, currentTime, duration, framerate, rotation,
  size }`. AVPlayer/MediaPlayer decode, a frame never enters JS as pixels or as
  a pointer, and frames are pulled on the UI thread, so a busy JS thread does
  not stall playback. `currentFrame` is one stable object, owned by the player.
  Needs Reanimated. See [docs/video.md](docs/video.md).
- `setImageCacheLimit(bytes)` — byte budget for decoded images (64 MB). A
  decoded image is resident twice, as CPU pixels and as the GPU texture uploaded
  from them, so this is applied to both the pixel cache and tgfx's context cache.

## Requirements

- React Native with the **New Architecture** (Nitro Views are Fabric-only).
- `react-native-nitro-modules` **0.36.5+**.
- iOS: Metal. Android: Vulkan by default, or OpenGL ES with `TgfxVulkan=OFF`.

The [example app](../../apps/example/package.json) currently uses React Native
0.85.3 and React 19.2.3. See [Contributing](../../CONTRIBUTING.md) for the native
build and test setup.

## Monorepo setup

Published npm packages include tgfx's prebuilt static libraries. For a git
checkout, run these commands from the repository root to install dependencies
and download the pinned prebuilt libraries and headers:

```bash
bun install
bun run bootstrap
```

This does not require access to the private tgfx submodule. To build tgfx from
source instead, initialize the submodule, fetch its dependencies with `depsync`,
then run the platform build scripts from the repository root:

```bash
git submodule update --init --recursive
(cd packages/react-native-tgfx/cpp/third_party/tgfx && npx --yes depsync)
bash packages/react-native-tgfx/scripts/build-tgfx-ios.sh       # device + simulator slices
bash packages/react-native-tgfx/scripts/build-tgfx-android.sh   # OpenGL ES + Vulkan, all 4 ABIs
```

## On-device rendering tests

Rendering is verified with [React Native Harness][harness] image snapshots,
which mount a real `<Canvas>` in the example app and screenshot it — no app
navigation and no UI selectors.

```bash
cd apps/example
bun run android                      # install a debug build on the configured device
bun run harness
```

Tests live in `apps/example/src/*.harness.tsx`; baselines land in
`apps/example/src/__image_snapshots__/<runner>/`. Runners are declared in
`apps/example/rn-harness.config.mjs`.

The default `android` runner targets a Samsung SM-E146B. Image baselines are
device-specific: GPU, density and anti-aliasing affect the pixels. Configure
your device in `rn-harness.config.mjs` and review regenerated baselines when
changing devices. Run image suites on a physical device; the software emulator
renderer does not draw image-backed scenes correctly. See
[Contributing](../../CONTRIBUTING.md#running-the-tests) for the iOS simulator
and CI runners.

**Never delete a baseline to "fix" a failure.** A missing baseline is written on
the spot and reported as a pass, so a checkout with no baselines passes without
comparing anything. Regenerate deliberately: delete the file, re-run, then open
the new PNG and confirm it is actually correct before committing it.

Snapshot targets must use `composite="texture"`: a screenshot draws the view
tree into a bitmap, and a `composite="layer"` canvas lives on its own
compositor layer where nothing can see it.

[harness]: https://react-native-harness.dev

## License

MIT — wraps tgfx (BSD-3-Clause) and Nitro (MIT).
