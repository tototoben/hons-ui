/**
 * The visitor's own face, captured during Station I's scan, then carried
 * to the photobash ending — same in-memory, same-session pattern as
 * visitorProfile.ts. Never written to disk or localStorage; cleared on
 * reset like the rest of the journey state.
 */

import { postWallDiagnostic } from './wallDiagnostics'

const CAPTURE_WIDTH = 864
const CAPTURE_HEIGHT = 960

// 2026-09-11: the capture fires on the first frame with any dimensions at
// all, before the camera has necessarily decoded a real image -- two
// visitors today got a solid-black frame locked in as "their photo" for
// the rest of the visit (never crossed the mean-luminance floor, so
// MediaPipe never found a face in it either, so the immediate-capture path
// never got a landmark-validated upgrade to replace it with). Refusing a
// near-black frame outright means capture naturally retries on the next
// tick instead of ever accepting it.
const MEAN_LUMINANCE_FLOOR = 12 // 0-255; a lit face reads well above this

let current: string | null = null

export function setVisitorFaceCapture(dataUrl: string | null) {
  current = dataUrl
}

export function getVisitorFaceCapture(): string | null {
  return current
}

export function resetVisitorFaceCapture() {
  current = null
}

/**
 * Cover-crop a mirrored (scaleX(-1), matching what the visitor saw on
 * screen) frame from the live camera video into a portrait canvas at the
 * same aspect as MATCH_FACE_SIZE, so it drops straight into the collage
 * grid with no further scaling. Returns null if the video has no frame
 * data yet.
 */
export function captureVisitorFaceFrame(
  video: HTMLVideoElement,
  landmarks?: Array<{ x: number; y: number }>,
): string | null {
  const sourceWidth = video.videoWidth
  const sourceHeight = video.videoHeight
  if (!sourceWidth || !sourceHeight) return null

  const canvas = document.createElement('canvas')
  canvas.width = CAPTURE_WIDTH
  canvas.height = CAPTURE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const targetRatio = CAPTURE_WIDTH / CAPTURE_HEIGHT
  const sourceRatio = sourceWidth / sourceHeight
  let sx = 0
  let sy = 0
  let sw = sourceWidth
  let sh = sourceHeight
  if (sourceRatio > targetRatio) {
    sh = sourceHeight
    sw = sh * targetRatio
    if (landmarks && landmarks.length > 0) {
      const anchor = landmarks[1] ?? landmarks[0]
      const centerX = anchor.x * sourceWidth
      sx = Math.max(0, Math.min(sourceWidth - sw, centerX - sw / 2))
    } else {
      sx = (sourceWidth - sw) / 2
    }
  } else {
    sw = sourceWidth
    sh = sw / targetRatio
    if (landmarks && landmarks.length > 0) {
      const anchor = landmarks[1] ?? landmarks[0]
      const centerY = anchor.y * sourceHeight
      sy = Math.max(0, Math.min(sourceHeight - sh, centerY - sh * 0.42))
    } else {
      sy = Math.max(0, (sourceHeight - sh) * 0.38)
    }
  }

  const luminance = sampleMeanLuminance(video, sx, sy, sw, sh)
  const landmarkCount = landmarks?.length ?? 0
  if (luminance !== null && luminance < MEAN_LUMINANCE_FLOOR) {
    postWallDiagnostic('face_capture', {
      accepted: false,
      reason: 'near_black_frame',
      mean_luminance: Math.round(luminance * 10) / 10,
      landmark_count: landmarkCount,
    })
    return null
  }

  ctx.save()
  ctx.translate(CAPTURE_WIDTH, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT)
  ctx.restore()

  try {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    postWallDiagnostic('face_capture', {
      accepted: true,
      reason: landmarkCount > 0 ? 'landmark_anchored' : 'center_crop',
      mean_luminance: luminance === null ? -1 : Math.round(luminance * 10) / 10,
      landmark_count: landmarkCount,
      width: CAPTURE_WIDTH,
      height: CAPTURE_HEIGHT,
      bytes: dataUrl.length,
    })
    return dataUrl
  } catch {
    return null
  }
}

/**
 * Mean luminance (0-255) of a source region, sampled from a small 16x16
 * downscale so this is cheap enough to run on every capture tick. Returns
 * null (fail open -- never block a capture on the probe itself) if the
 * canvas can't be read, which should not happen for a local camera stream.
 */
function sampleMeanLuminance(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): number | null {
  const probe = document.createElement('canvas')
  const size = 16
  probe.width = size
  probe.height = size
  const pctx = probe.getContext('2d', { willReadFrequently: true })
  if (!pctx) return null
  try {
    pctx.drawImage(source, sx, sy, sw, sh, 0, 0, size, size)
    const { data } = pctx.getImageData(0, 0, size, size)
    let total = 0
    const pixelCount = data.length / 4
    for (let i = 0; i < data.length; i += 4) {
      total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    }
    return pixelCount > 0 ? total / pixelCount : null
  } catch {
    return null
  }
}
