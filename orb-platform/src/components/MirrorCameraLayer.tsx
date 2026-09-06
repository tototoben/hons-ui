import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
import { FaceLandmarker } from '@mediapipe/tasks-vision'
import { useMirrorCamera, type MirrorCameraSample } from '../hooks/useMirrorCamera'
import { useStationVibe } from '../hooks/useStationVibe'
import {
  formatMorphometricLine,
  type FaceAppearance,
} from '../lib/mirrorFaceAppearance'
import type { MirrorFaceSignals } from '../lib/mirrorFaceSignals'
import { sampleFaceTopologyConnections } from '../lib/mirrorFaceTopology'
import { TRACKING_RGB } from '../lib/stationVibe'
import { canvasPixelRatio, isKioskQuality } from '../lib/deviceQuality'
import { readDeviceLock } from '../lib/deviceLock'
import {
  computeCameraFocus,
  landmarkBounds,
  mapLandmarkToMirror,
  type CameraFocusMode,
  type Dimensions,
  type NormalizedLandmark,
} from '../lib/mirrorLandmarks'
import { MirrorScanOverlay } from './MirrorScanOverlay'
import { captureVisitorFaceFrame, setVisitorFaceCapture } from '../lib/visitorFaceCapture'

const FACE_CAPTURE_MIN_LANDMARKS = 400
const FACE_CAPTURE_INTERVAL_MS = 500

const CameraDevPanel = lazy(() =>
  import('../dev/CameraDevPanel').then((m) => ({ default: m.CameraDevPanel })),
)

export type MirrorOverlayMode = 'none' | 'face' | 'eyes' | 'dissolve'

const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365,
  379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234,
  127, 162, 21, 54, 103, 67, 109,
]
const LEFT_EYE = [33, 160, 158, 133, 153, 144]
const RIGHT_EYE = [362, 385, 387, 263, 373, 380]
const NOSE = [168, 6, 197, 195, 5, 4, 1]
const LIPS = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146]
const SPARSE_FACE_TOPOLOGY = sampleFaceTopologyConnections(
  FaceLandmarker.FACE_LANDMARKS_TESSELATION,
)

export function MirrorCameraLayer({ mode }: { mode: MirrorOverlayMode }) {
  const [vibe] = useStationVibe()
  const trackingRgb = TRACKING_RGB[vibe]
  const camera = useMirrorCamera({ tracking: mode !== 'none' })
  // The handle is a fresh object every render; the paint loop below wants
  // the latest one without being torn down and restarted for it.
  const cameraRef = useRef(camera)
  cameraRef.current = camera
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const appearanceStoreRef = useRef<AppearanceStore | null>(null)
  appearanceStoreRef.current ??= createAppearanceStore()
  const appearanceStore = appearanceStoreRef.current
  const focusMode: CameraFocusMode = mode === 'eyes' ? 'eyes' : mode === 'none' ? 'full' : 'face'
  const style = poseProperties(camera.landmarks, camera.signals, focusMode) as CSSProperties

  // Keep the latest well-tracked frame in the visitor-face store — 'face'
  // mode covers scan-face/scan-focus, so by the time Station I completes
  // this holds a recent, in-focus still. Same-session, in-memory only
  // (visitorFaceCapture.ts), never persisted.
  const lastCaptureAt = useRef(0)

  // Detect ticks land in camera.sampleRef without a re-render, so the
  // canvas, the stage's custom properties and the trait readout are all
  // driven from here instead of from props changing.
  useEffect(() => {
    // Handles that predate sampleRef (station test mocks) only carry a
    // single static snapshot.
    const snapshot: MirrorCameraSample = {
      landmarks: cameraRef.current.landmarks,
      signals: cameraRef.current.signals,
      appearance: cameraRef.current.appearance,
    }
    let painted: MirrorCameraSample | null = null
    let raf = 0

    const paint = (force = false) => {
      const handle = cameraRef.current
      const sample = handle.sampleRef?.current ?? snapshot
      // One repaint per detect tick, not per animation frame.
      if (!force && sample === painted) return
      painted = sample

      const stage = stageRef.current
      if (stage) {
        Object.entries(poseProperties(sample.landmarks, sample.signals, focusMode)).forEach(
          ([property, value]) => stage.style.setProperty(property, String(value)),
        )
      }
      // Overlay mode 'none' keeps the camera live but draws nothing and
      // leaves whatever was last on the canvas alone.
      if (mode === 'none') return

      const canvas = canvasRef.current
      const video = handle.videoRef.current
      if (canvas && video) {
        drawLandmarks(canvas, video, sample.landmarks, sample.signals, mode, trackingRgb)
      }

      appearanceStore.write(sample.appearance)

      if (mode === 'face' && video && sample.landmarks.length >= FACE_CAPTURE_MIN_LANDMARKS) {
        const now = performance.now()
        if (now - lastCaptureAt.current >= FACE_CAPTURE_INTERVAL_MS) {
          lastCaptureAt.current = now
          const frame = captureVisitorFaceFrame(video)
          if (frame) setVisitorFaceCapture(frame)
        }
      }
    }

    // Paint on mount rather than waiting a frame, so the overlay is never
    // one animation frame behind the video.
    paint(true)
    if (mode === 'none') return

    const tick = () => {
      paint()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const repaint = () => paint(true)
    window.addEventListener('resize', repaint)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', repaint)
    }
  }, [appearanceStore, focusMode, mode, trackingRgb])

  return (
    <>
      <div
        ref={stageRef}
        className={`journey-camera-stage journey-camera-${mode}${mode === 'dissolve' ? ' is-dissolving' : ''}`}
        style={style}
        aria-hidden="true"
      >
        <video ref={camera.videoRef} className="journey-camera-video" muted playsInline autoPlay />
        <div className="journey-camera-veil" />
        <canvas ref={canvasRef} className="journey-landmarks" />
        {camera.status === 'denied' || camera.status === 'unavailable' ? (
          <div className="journey-camera-fallback">Camera unavailable</div>
        ) : null}
      </div>
      {/* Outside the zoom-transformed stage above on purpose — this HUD
          chrome (decorative debris + the real trait readout) should stay
          put as the camera focus zooms in/out on eyes vs. face, not scale
          with it. */}
      <MirrorScanOverlay mode={mode} />
      {mode !== 'none' ? (
        <AppearanceReadout store={appearanceStore} dissolving={mode === 'dissolve'} />
      ) : null}
      {/* Also excluded in Vitest (MODE === 'test'): leva's stitches-based
          styling can't run in jsdom, and MirrorCameraLayer.runtime.test.tsx/
          StationOne.runtime.test.tsx both fully mount this component. */}
      {import.meta.env.DEV && import.meta.env.MODE !== 'test' && !readDeviceLock() ? (
        <Suspense fallback={null}>
          <CameraDevPanel camera={camera} />
        </Suspense>
      ) : null}
    </>
  )
}

/** The stage's zoom / pose custom properties. Written on the element by
 * the paint loop and as the initial `style` prop, so both agree. */
function poseProperties(
  landmarks: NormalizedLandmark[],
  signals: MirrorFaceSignals,
  focusMode: CameraFocusMode,
): Record<string, string | number> {
  const focus = computeCameraFocus(landmarks, focusMode)
  const focusX = clamp(focus.originX + signals.headYaw * 2.8, 22, 78)
  const focusY = clamp(focus.originY + signals.headPitch * 2.2, 22, 72)
  return {
    '--journey-focus-scale': focus.scale,
    '--journey-focus-x': `${focusX}%`,
    '--journey-focus-y': `${focusY}%`,
    '--journey-pose-x': `${signals.headYaw * 8}px`,
    '--journey-pose-y': `${signals.headPitch * 6}px`,
    '--journey-pose-roll': `${signals.headRoll * 1.8}deg`,
    '--journey-tracking-glow': `${4 + signals.browLift * 7}px`,
  }
}

type AppearanceStore = {
  subscribe: (listener: () => void) => () => void
  read: () => FaceAppearance | null
  write: (next: FaceAppearance | null) => void
}

/** The trait readout is the one piece of the camera tree that has to
 * re-render when a sample changes, so it gets a store of its own instead
 * of putting the whole sample back into React state. */
function createAppearanceStore(): AppearanceStore {
  let appearance: FaceAppearance | null = null
  const listeners = new Set<() => void>()
  return {
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    read: () => appearance,
    write: (next) => {
      if (next === appearance) return
      appearance = next
      listeners.forEach((listener) => listener())
    },
  }
}

function drawLandmarks(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  landmarks: NormalizedLandmark[],
  signals: MirrorFaceSignals,
  mode: MirrorOverlayMode,
  trackingRgb: string,
) {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const ratio = canvasPixelRatio()
  canvas.width = Math.max(1, Math.round(width * ratio))
  canvas.height = Math.max(1, Math.round(height * ratio))
  const context = canvas.getContext('2d')
  if (!context) return
  context.scale(ratio, ratio)
  context.clearRect(0, 0, width, height)
  if (landmarks.length === 0) return

  const videoSize = {
    width: video.videoWidth || 1080,
    height: video.videoHeight || 1920,
  }
  const viewport = { width, height }
  const point = (index: number) =>
    landmarks[index]
      ? mapLandmarkToMirror(landmarks[index], viewport, videoSize)
      : null
  const drawPath = (indices: number[], alpha: number, lineWidth: number) => {
    const points = indices.map(point).filter((item): item is { x: number; y: number } => Boolean(item))
    if (points.length < 2) return
    context.beginPath()
    context.moveTo(points[0].x, points[0].y)
    points.slice(1).forEach((item) => context.lineTo(item.x, item.y))
    context.closePath()
    context.strokeStyle = `rgba(${trackingRgb}, ${alpha})`
    context.lineWidth = lineWidth
    context.stroke()
  }

  const dissolve = mode === 'dissolve'
  const drawMesh = mode !== 'none' && !isKioskQuality()
  if (drawMesh) {
    context.beginPath()
    let topologyEdges = 0
    SPARSE_FACE_TOPOLOGY.forEach(({ start, end }) => {
      const from = point(start)
      const to = point(end)
      if (!from || !to) return
      context.moveTo(from.x, from.y)
      context.lineTo(to.x, to.y)
      topologyEdges += 1
    })
    if (topologyEdges > 0) {
      context.strokeStyle = `rgba(${trackingRgb}, ${dissolve ? 0.04 : 0.16})`
      context.lineWidth = 0.55
      context.stroke()
    }
  }
  drawPath(FACE_OVAL, dissolve ? 0.24 : 0.82, 1.4)
  const eyeWidth = (mode === 'eyes' ? 2.4 : 1.7) + signals.blink * 1.1
  drawPath(LEFT_EYE, dissolve ? 0.1 : 0.94, eyeWidth)
  drawPath(RIGHT_EYE, dissolve ? 0.1 : 0.94, eyeWidth)
  drawPath(NOSE, dissolve ? 0.05 : 0.42, 1)
  drawPath(LIPS, dissolve ? 0.05 : 0.48 + signals.smile * 0.36, 1.1 + signals.mouthOpen * 1.2)

  const left = point(33)
  const right = point(263)
  if (left && right && !dissolve) {
    context.beginPath()
    context.moveTo(left.x, left.y - 20)
    context.lineTo(right.x, right.y - 20)
    context.strokeStyle = `rgba(${trackingRgb}, .84)`
    context.setLineDash([4, 7])
    context.stroke()
    context.setLineDash([])
  }

  ;[33, 263, 1].forEach((index, blobIndex) => {
    const center = point(index)
    if (!center || dissolve) return
    context.beginPath()
    context.ellipse(
      center.x + signals.gazeX * 12,
      center.y - signals.gazeY * 10,
      14 + blobIndex * 4,
      Math.max(2.5, (9 + blobIndex * 3) * (1 - signals.blink * 0.72)),
      blobIndex * 0.6,
      0,
      Math.PI * 2,
    )
    context.strokeStyle = `rgba(${trackingRgb}, .76)`
    context.lineWidth = 1.2
    context.stroke()
  })

  // TouchDesigner-style blob-tracking boxes — corner-bracket bounding
  // rects (not a full outline) around the whole face and each eye,
  // matching the reference sketch's tracking markers. Purely decorative
  // read-outs (fixed labels), not a real confidence score.
  if (mode !== 'none' && !dissolve) {
    const faceBox = trackingBoxFor(FACE_OVAL, landmarks, viewport, videoSize, 14)
    if (faceBox) drawTrackingBox(context, faceBox, 'FACE · TRACK', 0.55)
    const leftEyeBox = trackingBoxFor(LEFT_EYE, landmarks, viewport, videoSize, 9)
    if (leftEyeBox) drawTrackingBox(context, leftEyeBox, 'EYE.L', 0.7)
    const rightEyeBox = trackingBoxFor(RIGHT_EYE, landmarks, viewport, videoSize, 9)
    if (rightEyeBox) drawTrackingBox(context, rightEyeBox, 'EYE.R', 0.7)
  }
}

type TrackingBox = { x: number; y: number; width: number; height: number }

function trackingBoxFor(
  indices: number[],
  landmarks: NormalizedLandmark[],
  viewport: Dimensions,
  videoSize: Dimensions,
  padding: number,
): TrackingBox | null {
  const subset = indices.map((index) => landmarks[index]).filter(Boolean) as NormalizedLandmark[]
  const bounds = landmarkBounds(subset)
  if (!bounds) return null
  const a = mapLandmarkToMirror({ x: bounds.minX, y: bounds.minY }, viewport, videoSize)
  const b = mapLandmarkToMirror({ x: bounds.maxX, y: bounds.maxY }, viewport, videoSize)
  const x = Math.min(a.x, b.x) - padding
  const y = Math.min(a.y, b.y) - padding
  return {
    x,
    y,
    width: Math.abs(a.x - b.x) + padding * 2,
    height: Math.abs(a.y - b.y) + padding * 2,
  }
}

/** Four short L-shaped corner ticks (not a full rectangle stroke) plus a
 * small caption — the recognizable "blob tracker" look from TouchDesigner/
 * OpenCV debug overlays, reused from the same corner-bracket language as
 * Station III's HUD chrome. */
function drawTrackingBox(
  context: CanvasRenderingContext2D,
  box: TrackingBox,
  label: string,
  alpha: number,
) {
  const { x, y, width, height } = box
  const tick = clamp(Math.min(width, height) * 0.24, 5, 13)
  context.strokeStyle = `rgba(185, 220, 235, ${alpha})`
  context.lineWidth = 1
  const corners: Array<[number, number, number, number]> = [
    [x, y, 1, 1],
    [x + width, y, -1, 1],
    [x, y + height, 1, -1],
    [x + width, y + height, -1, -1],
  ]
  corners.forEach(([cx, cy, dx, dy]) => {
    context.beginPath()
    context.moveTo(cx, cy + tick * dy)
    context.lineTo(cx, cy)
    context.lineTo(cx + tick * dx, cy)
    context.stroke()
  })
  context.font = '9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  context.fillStyle = `rgba(185, 220, 235, ${alpha * 0.95})`
  context.fillText(label, x, Math.max(9, y - 5))
}

function AppearanceReadout({
  store,
  dissolving,
}: {
  store: AppearanceStore
  dissolving: boolean
}) {
  const appearance = useSyncExternalStore(store.subscribe, store.read, store.read)
  if (!appearance) return null

  return (
    <aside
      className={`journey-appearance${dissolving ? ' is-dissolving' : ''}`}
      aria-live="polite"
    >
      <dl>
        <AppearanceColor label="Hair color" swatch={appearance.hair} />
        <AppearanceColor label="Eye color" swatch={appearance.eyes} swatchId="eyes" />
      </dl>
      {appearance.morphometrics.length > 0 ? (
        <ul>
          {appearance.morphometrics.map((reading) => (
            <li key={reading.term}>{formatMorphometricLine(reading)}</li>
          ))}
        </ul>
      ) : null}
    </aside>
  )
}

function AppearanceColor({
  label,
  swatch,
  swatchId,
}: {
  label: string
  swatch: FaceAppearance['hair']
  swatchId?: 'eyes'
}) {
  const showSwatch = swatch.label !== 'undetected'

  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {showSwatch ? (
          <i
            className="journey-appearance-swatch"
            data-swatch={swatchId ?? 'hair'}
            style={{ background: swatch.hex }}
            aria-hidden="true"
          />
        ) : null}
        {swatch.label}
      </dd>
    </div>
  )
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}
