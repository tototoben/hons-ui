/**
 * Lightweight performance monitor for orb-platform.
 *
 * Zero dependencies. Activated by `?perf=1` query param.
 *
 * - Tracks FPS, frame times (p50/p95/p99), draw calls, triangles,
 *   geometries, textures, programs, and JS heap via rAF.
 * - Beacons snapshots to the Vite dev server at `/api/log-perf`
 *   which appends them to `perf-log.jsonl`.
 * - In production (no Vite server), beacons fail silently — zero overhead.
 * - Also logs to console for DevTools / CDP capture.
 * - Exposes `window.__perf` for manual control and inspection.
 */

export type PerfSnapshot = {
  view: string
  timestamp: number
  fps: number
  fpsMin: number
  fpsMax: number
  avgFrameMs: number
  p50FrameMs: number
  p95FrameMs: number
  p99FrameMs: number
  drawCalls: number
  triangles: number
  geometries: number
  textures: number
  programs: number
  jsHeapUsedMB: number | null
  jsHeapTotalMB: number | null
  frameCount: number
}

type FrameSample = { time: number; frameMs: number }

const ROLLING_WINDOW = 120
const BEACON_INTERVAL_MS = 3000

let samples: FrameSample[] = []
let lastFrameTime = 0
let frameCount = 0
let currentView = 'unknown'
let enabled = false
let beaconTimer: number | null = null
let renderer: ThreeRendererInfo | null = null

type ThreeRendererInfo = {
  info: {
    render: { calls: number; triangles: number }
    memory: { geometries: number; textures: number }
    programs: { length: number } | null
  }
}

declare global {
  interface Window {
    __perf?: {
      get enabled(): boolean
      get currentView(): string
      get lastSnapshot(): PerfSnapshot | null
      setView: (v: string) => void
      attachRenderer: (r: ThreeRendererInfo) => void
      enable: () => void
      disable: () => void
      getSummary: () => Record<string, unknown>
      clear: () => void
    }
  }
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

function takeSnapshot(): PerfSnapshot {
  const frameTimes = samples.map((s) => s.frameMs).sort((a, b) => a - b)
  const fpsValues =
    samples.length > 1
      ? samples
          .slice(1)
          .map((s, i) => {
            const dt = s.time - samples[i].time
            return dt > 0 ? 1000 / dt : null
          })
          .filter((v): v is number => v !== null)
      : [0]
  const fpsSorted = [...fpsValues].sort((a, b) => a - b)
  const mem = (
    performance as Performance & {
      memory?: { usedJSHeapSize: number; totalJSHeapSize: number }
    }
  ).memory

  return {
    view: currentView,
    timestamp: performance.now(),
    fps: fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length,
    fpsMin: fpsSorted[0] ?? 0,
    fpsMax: fpsSorted[fpsSorted.length - 1] ?? 0,
    avgFrameMs: frameTimes.reduce((a, b) => a + b, 0) / (frameTimes.length || 1),
    p50FrameMs: pct(frameTimes, 50),
    p95FrameMs: pct(frameTimes, 95),
    p99FrameMs: pct(frameTimes, 99),
    drawCalls: renderer?.info.render.calls ?? 0,
    triangles: renderer?.info.render.triangles ?? 0,
    geometries: renderer?.info.memory.geometries ?? 0,
    textures: renderer?.info.memory.textures ?? 0,
    programs: renderer?.info.programs?.length ?? 0,
    jsHeapUsedMB: mem ? mem.usedJSHeapSize / 1048576 : null,
    jsHeapTotalMB: mem ? mem.totalJSHeapSize / 1048576 : null,
    frameCount,
  }
}

function beacon(snap: PerfSnapshot) {
  const body = JSON.stringify(snap)
  // Console log for DevTools / CDP capture
  console.log(
    `[perf] view=${snap.view} fps=${snap.fps.toFixed(1)} `
      + `frameMs avg=${snap.avgFrameMs.toFixed(2)} p95=${snap.p95FrameMs.toFixed(2)} `
      + `drawCalls=${snap.drawCalls} tris=${snap.triangles} `
      + `geos=${snap.geometries} texs=${snap.textures} progs=${snap.programs} `
      + `heap=${snap.jsHeapUsedMB?.toFixed(1) ?? '?'}MB`,
  )
  // Beacon to Vite middleware (fails silently in production)
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/log-perf', body)
    } else {
      void fetch('/api/log-perf', { method: 'POST', body, keepalive: true })
    }
  } catch {
    // No Vite server — ignore
  }
}

/** Called from R3F useFrame — records a frame timing sample. */
export function perfFrame() {
  if (!enabled) return
  const now = performance.now()
  const frameMs = lastFrameTime > 0 ? now - lastFrameTime : 16.67
  lastFrameTime = now
  frameCount++
  samples.push({ time: now, frameMs })
  if (samples.length > ROLLING_WINDOW) samples.shift()
}

function startBeacons() {
  if (beaconTimer !== null) return
  beaconTimer = window.setInterval(() => {
    if (samples.length === 0) return
    beacon(takeSnapshot())
  }, BEACON_INTERVAL_MS)
}

function stopBeacons() {
  if (beaconTimer !== null) {
    clearInterval(beaconTimer)
    beaconTimer = null
  }
}

/** Attach the Three.js renderer for draw call / triangle stats. */
export function perfAttachRenderer(r: ThreeRendererInfo) {
  renderer = r
}

/** Set the current view name (e.g. "station-1", "orb", "cards"). */
export function perfSetView(view: string) {
  if (currentView === view) return
  if (enabled && samples.length > 0) beacon(takeSnapshot())
  currentView = view
  samples = []
  lastFrameTime = 0
  console.log(`[perf] view -> ${view}`)
}

/** Enable performance monitoring. */
export function perfEnable() {
  if (enabled) return
  enabled = true
  samples = []
  frameCount = 0
  lastFrameTime = 0
  startBeacons()
  console.log('[perf] monitoring enabled')
}

/** Disable performance monitoring. */
export function perfDisable() {
  if (!enabled) return
  if (samples.length > 0) beacon(takeSnapshot())
  enabled = false
  stopBeacons()
  console.log('[perf] monitoring disabled')
}

/** Clear collected samples. */
export function perfClear() {
  samples = []
  frameCount = 0
  lastFrameTime = 0
}

/** Get a summary of all beaconed views. */
export function perfGetSummary(): Record<string, unknown> {
  return {
    currentView,
    frameCount,
    sampleCount: samples.length,
    lastSnapshot: samples.length > 0 ? takeSnapshot() : null,
  }
}

// Auto-enable when ?perf=1 query param is present
if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search)
  if (params.get('perf') === '1') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => perfEnable())
    } else {
      perfEnable()
    }
  }

  window.__perf = {
    get enabled() { return enabled },
    get currentView() { return currentView },
    get lastSnapshot() { return samples.length > 0 ? takeSnapshot() : null },
    setView: perfSetView,
    attachRenderer: perfAttachRenderer,
    enable: perfEnable,
    disable: perfDisable,
    getSummary: perfGetSummary,
    clear: perfClear,
  }
}
