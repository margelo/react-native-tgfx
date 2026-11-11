#!/usr/bin/env node
// Host half of the bench: restarts the app, tails logcat for its `[bench]`
// lines, and samples CPU (/proc/<pid>/stat) and memory (dumpsys meminfo) per
// second. Writes a per-scene table when the app prints `[bench] done`.
//
//   node bench/run.mjs [--package com.tgfxskiabench]
//
// Install a RELEASE build first: benchmarking a debug build measures the
// debug overhead, not the engines.
import { execFile, spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const shotsDir = join(dirname(fileURLToPath(import.meta.url)), 'shots');
mkdirSync(shotsDir, { recursive: true });

const args = process.argv.slice(2);
function arg(name, fallback) {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] !== undefined ? args[at + 1] : fallback;
}
const PACKAGE = arg('package', 'com.tgfxskiabench');
// 'atrace' counts SF `queueBuffer - <layer>` events (Android 14+); 'latency'
// reads `dumpsys SurfaceFlinger --latency` present timestamps (Android <= 13).
const PRESENT = arg('present', 'atrace');
// Matrix selection, forwarded to the app through the launch URL (see App.tsx buildPlan).
// --gap <seconds> idles the phone with no canvas between combos, so heat from one
// engine's run is not carried into the next one's.
const GAP = Number(arg('gap', '0'));
const ALL_SCENES = 'shapes,images,shader,pattern,paths,text,anim-decl,anim-imp,shapes-picture';
// surface: both engines on a SurfaceView; texture: both on a TextureView.
const VIEWS = arg('views', 'surface,texture');
// --skip tgfx:anim-imp drops engine:scene pairs (from every view).
const SKIP = new Set(arg('skip', '').split(',').filter(Boolean));
const EXTRA = `&dif=${arg('dif', 'on')}&imp=${arg('imp', 'ui')}&sktext=${arg('sktext', 'text')}`;
// The plan is built here and every combo runs in a process of its own: the app
// is force-stopped and relaunched with a one-combo URL. In one long-lived
// process the heavy scenes leave caches and heap behind (PSS passed 2 GB), and
// the rows after them were measured in a different state than the rows before.
const PLAN = (() => {
  const engines = arg('engines', 'tgfx,skia').split(',');
  const scenes = arg('scenes', ALL_SCENES).split(',');
  const one = VIEWS.split(',').flatMap(v =>
    arg('order', 'sequential') === 'alternate'
      ? scenes.flatMap(s => engines.map(e => [e, s, v]))
      : engines.flatMap(e => scenes.map(s => [e, s, v]))
  ).filter(([e, s]) => !SKIP.has(`${e}:${s}`));
  return Array.from({ length: Number(arg('reps', '1')) }, () => one).flat();
})();
const COMBOS = PLAN.length;
// What atrace's `queueBuffer - <layer>` names the canvas's layer, per view. A
// SurfaceView is its own BLAST layer. A TextureView has no layer: its frames
// reach the screen only when the window's RenderThread composites them, so the
// count is the app window's own queueBuffer, which nothing else in this app
// redraws while a combo runs.
// Samsung's Android 16 prefixes the layer with a hex id
// (`queueBuffer - bc510b2 SurfaceView[...]`); the grep allows it.
const LAYERS = {
  surface: arg('surface-layer', `SurfaceView\\[${PACKAGE}`),
  texture: arg('texture-layer', `VRI\\[MainActivity\\]`),
};
const SETTLE_TICKS = 3;
const HZ = 100; // Linux USER_HZ

function adb(...adbArgs) {
  return new Promise(resolve => {
    execFile('adb', adbArgs, { maxBuffer: 4 * 1024 * 1024 }, (error, stdout) =>
      resolve(error ? null : (stdout ?? '').toString())
    );
  });
}

const median = values => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** combo key -> per-second samples, plus per-thread CPU keyed by thread group */
const combos = new Map();
let current = null;
function comboBucket(key) {
  if (!combos.has(key)) {
    combos.set(key, { ticks: [], cpu: [], pss: [], java: [], native: [], graphics: [], presents: [], thermal: [], cap: [], threads: new Map() });
  }
  return combos.get(key);
}

// ---- CPU + PSS sampler -----------------------------------------------------

let lastCpu = null;
// One adb connection per sample: pid, /proc stat and PSS in a single shell round
// trip. Three connections a second was enough to wedge the host adb server
// mid-run, taking the logcat stream down with it.
async function sample() {
  if (busy) return;
  busy = true;
  const out = await adb(
    'shell',
    `cat /proc/uptime; pid=$(pidof ${PACKAGE}); echo "PID $pid"; [ -n "$pid" ] && cat /proc/$pid/stat; dumpsys meminfo ${PACKAGE} | grep -E 'TOTAL PSS|Java Heap:|Native Heap:|Graphics:'`
  );
  busy = false;
  if (!out) return;
  // Device clock, not host: adb round trips add up to 2s of skew per sample.
  const now = Number(out.match(/^(\d+\.\d+) /m)?.[1]) * 1000;
  const pid = out.match(/^PID (\d+)/m)?.[1];
  const stat = out.match(/^\d+ \(.*\) .*$/m)?.[0];
  if (pid && stat) {
    const after = stat.slice(stat.lastIndexOf(') ') + 2).trim().split(/\s+/);
    // after[0] is field 3 (state); utime is field 14, stime 15.
    const ticks = Number(after[11]) + Number(after[12]);
    if (Number.isFinite(ticks)) {
      if (lastCpu && lastCpu.pid === pid) {
        const wall = (now - lastCpu.at) / 1000;
        const pct = ((ticks - lastCpu.ticks) / HZ / wall) * 100;
        if (current && wall > 0.2 && pct >= 0) comboBucket(current).cpu.push(pct);
      }
      lastCpu = { pid, ticks, at: now };
    }
  }
  if (!current) return;
  const bucket = comboBucket(current);
  for (const [field, label] of [['pss', 'TOTAL PSS'], ['java', 'Java Heap'], ['native', 'Native Heap'], ['graphics', 'Graphics']]) {
    const kb = out.match(new RegExp(`${label}:\\s+(\\d+)`));
    if (kb) bucket[field].push(Number(kb[1]));
  }
}

// ---- per-thread CPU ---------------------------------------------------------
// Two snapshots of every thread's utime+stime, 8s apart, inside the measured
// window. Pool threads are grouped by name with the trailing index dropped.
const THREAD_WINDOW_MS = 8000;
async function threadSnapshot() {
  const out = await adb('shell', `cat /proc/uptime; pid=$(pidof ${PACKAGE}); for t in /proc/$pid/task/*; do cat $t/stat; done 2>/dev/null`);
  const at = Number(out?.match(/^(\d+\.\d+) /m)?.[1]);
  const ticks = new Map();
  for (const line of (out ?? '').split('\n')) {
    const m = line.match(/^(\d+) \((.*)\) (.*)$/);
    if (!m) continue;
    const f = m[3].trim().split(/\s+/);
    ticks.set(m[1], { name: m[2], ticks: Number(f[11]) + Number(f[12]) });
  }
  return { at, ticks };
}
async function sampleThreads(key) {
  const a = await threadSnapshot();
  await new Promise(r => setTimeout(r, THREAD_WINDOW_MS));
  const b = await threadSnapshot();
  const wall = b.at - a.at;
  if (!(wall > 1)) return;
  const groups = new Map();
  for (const [tid, t] of b.ticks) {
    const before = a.ticks.get(tid);
    if (!before) continue;
    const name = t.name === PACKAGE.slice(-15) ? 'UI' : t.name === 'mqt_v_js' ? 'JS' : t.name.replace(/[\s:_-]*[\d_]+$/, '');
    groups.set(name, (groups.get(name) ?? 0) + ((t.ticks - before.ticks) / HZ / wall) * 100);
  }
  const threads = comboBucket(key).threads;
  for (const [name, pct] of groups) {
    if (!threads.has(name)) threads.set(name, []);
    threads.get(name).push(pct);
  }
}
let busy = false;

// Android's thermal status as each combo starts: a hot phone throttles whichever
// engine runs next, and the table should show it.
async function sampleThermal(key) {
  const out = await adb('shell', 'dumpsys thermalservice | grep "Thermal Status"');
  const status = Number(out?.match(/Thermal Status: (\d+)/)?.[1]);
  if (Number.isFinite(status)) comboBucket(key).thermal.push(status);
  const cap = await cpuCap();
  if (cap != null) comboBucket(key).cap.push(cap);
}

// The thermal status hides most of the throttling: a Galaxy S25 Edge at status
// 1 ("light") had its clusters capped at 1.8 of 3.5 GHz and 1.7 of 4.5 GHz, and
// a CPU-bound row read 45 fps or 90 with the cap alone deciding which. This is
// the lowest scaling_max_freq / cpuinfo_max_freq over the cpufreq policies:
// 1 means no cap.
async function cpuCap() {
  const out = await adb('shell', 'for p in /sys/devices/system/cpu/cpufreq/policy*; do echo "$(cat $p/scaling_max_freq) $(cat $p/cpuinfo_max_freq)"; done');
  const ratios = (out ?? '').trim().split('\n').map(l => l.trim().split(/\s+/).map(Number)).filter(([a, b]) => a > 0 && b > 0).map(([a, b]) => a / b);
  return ratios.length ? Math.min(...ratios) : null;
}
// --cool <ratio> holds each combo until the cap is back above it (default 0.99,
// 0 to skip), for at most --cool-timeout seconds, app stopped.
const COOL = Number(arg('cool', '0.99'));
const COOL_TIMEOUT = Number(arg('cool-timeout', '600'));
async function waitCool() {
  if (!(COOL > 0)) return;
  const since = Date.now();
  for (;;) {
    const cap = await cpuCap();
    if (cap == null || cap >= COOL) break;
    if (Date.now() - since > COOL_TIMEOUT * 1000) {
      console.log(`[bench] still capped at ${(cap * 100).toFixed(0)}% after ${COOL_TIMEOUT}s, running anyway`);
      break;
    }
    lastHeard = Date.now() + 10000;
    await new Promise(r => setTimeout(r, 5000));
  }
  const waited = (Date.now() - since) / 1000;
  if (waited > 6) console.log(`[bench] cooled for ${waited.toFixed(0)}s`);
}

// ---- presented frames ------------------------------------------------------
// Thread FPS says the threads are healthy; only SurfaceFlinger knows what the
// canvas actually put on screen. atrace `queueBuffer - <layer>` events count
// buffers the canvas queued. Only the app's own SurfaceView layer counts:
// with GPU composition on, FramebufferSurface queues once per frame too, and
// the extra events overflow the default ring buffer inside 8s (hence -b).
const TRACE_SECONDS = 8;
let tracing = false;
async function latencyFps() {
  const list = await adb('shell', 'dumpsys', 'SurfaceFlinger', '--list');
  const layer = list?.split('\n').find(l => l.startsWith(`SurfaceView[${PACKAGE}/`) && l.includes('(BLAST)'));
  if (!layer) return null;
  const out = await adb('shell', 'dumpsys', 'SurfaceFlinger', '--latency', `'${layer.trim()}'`);
  const times = [...new Set((out ?? '').split('\n').slice(1).map(l => Number(l.trim().split(/\s+/)[1])).filter(t => t > 0 && t < 9e18))].sort((a, b) => a - b);
  if (times.length < 2) return null;
  return (times.length - 1) / ((times.at(-1) - times[0]) / 1e9);
}
async function samplePresentedLatency(key) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const fps = await latencyFps();
    if (fps != null) samples.push(fps);
    await new Promise(r => setTimeout(r, 2500));
  }
  if (samples.length === 0) return;
  comboBucket(key).presents.push(median(samples));
  console.log(`[bench] ${key} present=${median(samples).toFixed(1)}fps (latency x${samples.length})`);
}
function samplePresented(key, view) {
  if (PRESENT === 'latency') return void samplePresentedLatency(key);
  if (tracing) return;
  tracing = true;
  execFile(
    'adb',
    ['shell', `atrace -t ${TRACE_SECONDS} -b 8192 gfx 2>/dev/null | grep 'queueBuffer - \\([0-9a-f]* \\)\\{0,1\\}${LAYERS[view]}' | wc -l`],
    { maxBuffer: 16 * 1024 * 1024 },
    (error, stdout) => {
      tracing = false;
      const count = Number((stdout ?? '').trim());
      if (!error && Number.isFinite(count)) {
        comboBucket(key).presents.push(count / TRACE_SECONDS);
        console.log(`[bench] ${key} present=${(count / TRACE_SECONDS).toFixed(1)}fps`);
      }
    }
  );
}

// ---- logcat ----------------------------------------------------------------

function finish(reason) {
  clearInterval(timer);
  clearInterval(logcatWatchdog);
  const dead = logcat;
  logcat = null;
  dead?.kill();
  const rows = [];
  for (const [key, bucket] of combos) {
    const measured = bucket.ticks.slice(SETTLE_TICKS);
    if (measured.length === 0) continue;
    rows.push({
      key,
      present: bucket.presents.length ? median(bucket.presents) : null,
      js: median(measured.map(t => t.js)),
      ui: median(measured.map(t => t.ui)),
      cpu: median(bucket.cpu),
      pss: median(bucket.pss) / 1024,
      java: median(bucket.java) / 1024,
      native: median(bucket.native) / 1024,
      graphics: median(bucket.graphics) / 1024,
      threads: new Map([...bucket.threads].map(([name, pcts]) => [name, median(pcts)])),
      thermal: bucket.thermal.length ? Math.max(...bucket.thermal) : null,
      cap: bucket.cap.length ? Math.min(...bucket.cap) : null,
      n: measured.length,
    });
  }
  const lines = [
    `# tgfx vs skia bench (${reason})`,
    '',
    '| engine · scene · view | Present FPS | UI FPS | JS FPS | CPU % (1 core = 100) | PSS MB | thermal | CPU cap % | ticks |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map(r =>
      `| ${r.key} | ${r.present == null ? '?' : r.present.toFixed(1)} | ${r.ui.toFixed(0)} | ${r.js.toFixed(0)} | ${r.cpu.toFixed(0)} | ${r.pss.toFixed(1)} | ${r.thermal ?? '?'} | ${r.cap == null ? '?' : (r.cap * 100).toFixed(0)} | ${r.n} |`
    ),
    '',
    '`thermal` is the highest Android thermal status (0 none … 3 severe) seen at the start of the combo\'s runs. `CPU cap %` is the lowest scaling_max_freq / cpuinfo_max_freq seen during them: below 100 the kernel was throttling, whatever the status says.',
    '',
    '## Where the CPU and memory go',
    '',
    '| engine · scene · view | UI thread % | JS thread % | busiest other threads % | Graphics MB | Native MB | Java MB |',
    '|---|---|---|---|---|---|---|',
    ...rows.map(r => {
      const pct = name => (r.threads.get(name) ?? 0).toFixed(0);
      const others = [...r.threads]
        .filter(([name, p]) => name !== 'UI' && name !== 'JS' && p >= 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, p]) => `${name} ${p.toFixed(0)}`)
        .join(', ');
      return `| ${r.key} | ${pct('UI')} | ${pct('JS')} | ${others} | ${r.graphics.toFixed(1)} | ${r.native.toFixed(1)} | ${r.java.toFixed(1)} |`;
    }),
  ];
  const report = lines.join('\n');
  console.log(`\n${report}\n`);
  const out = join(dirname(fileURLToPath(import.meta.url)), `results-${Date.now()}.md`);
  writeFileSync(out, report + '\n');
  console.log(`[bench] wrote ${out}`);
  process.exit(rows.length > 0 ? 0 : 2);
}

// adb's logcat stream can die mid-run (Android 15 phones drop it after a few
// minutes); the app keeps going, the host just stops hearing it. Watch for
// silence and respawn from the last timestamp seen, dropping the one line
// `-T` re-delivers.
const LOGCAT_SILENCE_MS = 8000;
let logcat = null;
let pending = '';
let lastTimestamp = '1';
let lastLine = '';
let lastHeard = Date.now();
function startLogcat() {
  logcat = spawn('adb', ['logcat', '-T', lastTimestamp, '-s', 'ReactNativeJS:I']);
  pending = '';
  logcat.stdout.on('data', onLogcat);
  logcat.on('exit', () => {
    if (logcat) setTimeout(startLogcat, 500);
  });
}
function onLogcat(chunk) {
  lastHeard = Date.now();
  // BENCH_RAW_LOG=<file> keeps every byte logcat delivered, for debugging the runner itself.
  if (process.env.BENCH_RAW_LOG) appendFileSync(process.env.BENCH_RAW_LOG, chunk);
  pending += chunk.toString();
  const lines = pending.split('\n');
  pending = lines.pop() ?? '';
  for (const line of lines) {
    if (line === lastLine) continue;
    lastLine = line;
    const stamp = line.match(/^(\d\d-\d\d \d\d:\d\d:\d\d\.\d+)/);
    if (stamp) lastTimestamp = stamp[1];
    const start = line.match(/\[bench\] start engine=(\w+) scene=([\w-]+) view=(\w+)/);
    if (start) {
      current = `${start[1]} · ${start[2]} · ${start[3]}`;
      console.log(`[bench] >> ${current}`);
      const key = current;
      sampleThermal(key);
      // Again near the end: a cap that came down mid-combo should show.
      setTimeout(() => cpuCap().then(cap => cap != null && comboBucket(key).cap.push(cap)), 21000);
      // Two 8 s windows per combo; the row is their median (with two, the mean).
      setTimeout(() => samplePresented(key, start[3]), 6000);
      setTimeout(() => samplePresented(key, start[3]), 15500);
      setTimeout(() => sampleThreads(key), 7000);
      continue;
    }
    // The app freezes t=0 for 1.5s and prints this; a screencap inside the
    // window gives pixel-comparable parity stills across the two engines.
    const pose = line.match(/\[bench\] pose engine=(\w+) scene=([\w-]+) view=(\w+)/);
    if (pose) {
      const shot = join(shotsDir, `${pose[1]}-${pose[2]}-${pose[3]}.png`);
      execFile('bash', ['-c', `adb exec-out screencap -p > '${shot}'`], () => {});
      continue;
    }
    const tick = line.match(/\[bench\] tick engine=(\w+) scene=([\w-]+) view=(\w+) js=(\d+) ui=(\d+)/);
    if (tick) {
      const key = `${tick[1]} · ${tick[2]} · ${tick[3]}`;
      const bucket = comboBucket(key);
      bucket.ticks.push({ js: Number(tick[4]), ui: Number(tick[5]) });
      process.stdout.write(`[bench] ${key} js=${tick[4]} ui=${tick[5]}\n`);
      continue;
    }
    if (line.includes('[bench] done')) nextCombo();
  }
}
startLogcat();
const logcatWatchdog = setInterval(() => {
  if (Date.now() - lastHeard > LOGCAT_SILENCE_MS && logcat) {
    console.log(`[bench] logcat silent ${LOGCAT_SILENCE_MS / 1000}s, reconnecting and respawning from ${lastTimestamp}`);
    const dead = logcat;
    logcat = null;
    dead.kill();
    lastHeard = Date.now();
    busy = false;
    // The stream usually dies because the host adb server wedged; a reconnect
    // re-establishes the transport before the new logcat asks for it.
    adb('reconnect').then(startLogcat);
  }
}, 2000);

let at = -1;
let advancing = false;
async function nextCombo() {
  if (advancing) return;
  advancing = true;
  current = null;
  await adb('shell', 'am', 'force-stop', PACKAGE);
  at += 1;
  if (at >= PLAN.length) return finish('complete');
  // The gap is spent with the app dead: nothing of ours runs while the phone cools.
  if (at > 0 && GAP > 0) {
    lastHeard = Date.now() + GAP * 1000;
    await new Promise(r => setTimeout(r, GAP * 1000));
  }
  await waitCool();
  const [engine, scene, view] = PLAN[at];
  lastHeard = Date.now() + 5000;
  await adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-n', `${PACKAGE}/.MainActivity`, '-d', `'bench://run?engines=${engine}&scenes=${scene}&views=${view}${EXTRA}'`);
  advancing = false;
}
await nextCombo();
const timer = setInterval(sample, 1000);
// combos x (28s + gap) + startup, with slack.
// Cooling waits are bounded per combo, so the backstop has to allow for them.
setTimeout(() => finish('timeout'), (COMBOS * (28 + GAP + 12 + (COOL > 0 ? COOL_TIMEOUT : 0)) + 60) * 1000);
