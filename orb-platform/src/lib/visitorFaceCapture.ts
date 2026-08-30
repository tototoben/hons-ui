/**
 * The visitor's own face, captured once during Station I's face-analysis
 * phase and carried forward to Station III's photobash ending — same
 * in-memory, same-session pattern as visitorProfile.ts. Never written to
 * disk or localStorage; cleared on reset like the rest of the journey
 * state.
 */

const CAPTURE_WIDTH = 864
const CAPTURE_HEIGHT = 960

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
export function captureVisitorFaceFrame(video: HTMLVideoElement): string | null {
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
    sx = (sourceWidth - sw) / 2
  } else {
    sw = sourceWidth
    sh = sw / targetRatio
    sy = Math.max(0, (sourceHeight - sh) * 0.38)
  }

  ctx.save()
  ctx.translate(CAPTURE_WIDTH, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT)
  ctx.restore()

  try {
    return canvas.toDataURL('image/jpeg', 0.9)
  } catch {
    return null
  }
}
