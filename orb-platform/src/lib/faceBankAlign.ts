import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { PARALLAX } from '../config'
import {
  DEFAULT_VISITOR_ALIGN,
  MATCH_LEFT_EYE,
  MATCH_RIGHT_EYE,
  normalizeVisitorAlign,
  type VisitorAlign,
} from './wallMatchPhotobash'

/**
 * Auto-aligns an arbitrary face photo so the same downstream cover-crop math
 * (coverDrawImage/drawVisitorAligned, focusY=0.38) lands the eyes at the
 * same canonical spot the hand-tuned SHARD_POOL eye shards already assume —
 * so an "eye" shard shows an eye no matter which of the ~25 differently
 * framed bank photos fills it. One-time per image; results should be cached
 * by the caller (computing this is not free).
 */
const LEFT_EYE_OUTER = 33
const LEFT_EYE_INNER = 133
const RIGHT_EYE_OUTER = 263
const RIGHT_EYE_INNER = 362
const LEFT_IRIS = 468
const RIGHT_IRIS = 473
const FOCUS_Y = 0.38

export const TARGET_LEFT_EYE = MATCH_LEFT_EYE
export const TARGET_RIGHT_EYE = MATCH_RIGHT_EYE

type Point = { x: number; y: number }
type CropPoint = { u: number; v: number }

let landmarkerPromise: Promise<FaceLandmarker> | null = null
const alignCache = new WeakMap<HTMLImageElement, Map<number, Promise<VisitorAlign>>>()

function getImageLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(PARALLAX.wasmBase).then((vision) =>
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: PARALLAX.modelUrl, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numFaces: 1,
      }),
    )
  }
  return landmarkerPromise
}

/** Same crop-rect math as wallMatchPhotobash's coverDrawImage, but returning
 * the rect (in source pixels) instead of drawing — needed to map a raw
 * landmark position into "where it lands after the cover crop." */
export function coverCropRect(
  sourceWidth: number,
  sourceHeight: number,
  targetRatio: number,
  focusY: number,
) {
  const imageRatio = sourceWidth / sourceHeight
  let sx = 0
  let sy = 0
  let sw = sourceWidth
  let sh = sourceHeight
  if (imageRatio > targetRatio) {
    sh = sourceHeight
    sw = sh * targetRatio
    sx = (sourceWidth - sw) / 2
  } else {
    sw = sourceWidth
    sh = sw / targetRatio
    sy = Math.max(0, Math.min(sourceHeight - sh, sourceHeight * focusY - sh / 2))
  }
  return { sx, sy, sw, sh }
}

function midpoint(a: Point | undefined, b: Point | undefined): Point | null {
  if (!a || !b) return null
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** Prefer iris centers when the 478-point mesh is present; otherwise the
 * midpoint of each eye's inner/outer corners — never the outer corners
 * alone, which made faces too small for the eye shards. */
export function readEyeCenters(landmarks: Array<Point | undefined>): [Point, Point] | null {
  const leftIris = landmarks[LEFT_IRIS]
  const rightIris = landmarks[RIGHT_IRIS]
  if (leftIris && rightIris) return [leftIris, rightIris]
  const left = midpoint(landmarks[LEFT_EYE_INNER], landmarks[LEFT_EYE_OUTER])
  const right = midpoint(landmarks[RIGHT_EYE_INNER], landmarks[RIGHT_EYE_OUTER])
  if (!left || !right) return null
  return [left, right]
}

/**
 * Similarity (scale + pan) that puts crop-space eye centers onto the match
 * plate's eye-shard centroids. Pure so tests can check the lineup without
 * MediaPipe.
 */
export function alignFromCropEyes(left: CropPoint, right: CropPoint): VisitorAlign {
  const cropEyeDist = Math.hypot(right.u - left.u, right.v - left.v)
  const targetEyeDist = Math.hypot(
    TARGET_RIGHT_EYE.x - TARGET_LEFT_EYE.x,
    TARGET_RIGHT_EYE.y - TARGET_LEFT_EYE.y,
  )
  if (cropEyeDist < 1e-6) return { ...DEFAULT_VISITOR_ALIGN }
  const scale = targetEyeDist / cropEyeDist
  const cx = TARGET_LEFT_EYE.x - left.u * scale
  const vMid = (left.v + right.v) / 2
  const targetYMid = (TARGET_LEFT_EYE.y + TARGET_RIGHT_EYE.y) / 2
  const cy = targetYMid - vMid * scale
  const offsetX = cx - (1 - scale) / 2
  const offsetY = cy - (1 - scale) / 2
  return normalizeVisitorAlign({ scale, offsetX, offsetY })
}

/**
 * Detects eyes in a static image and derives a VisitorAlign (scale +
 * fractional offsets) such that drawVisitorAligned(ctx, image, width,
 * height, align) puts the eyes at TARGET_LEFT_EYE/TARGET_RIGHT_EYE in
 * plate-normalized space. Falls back to DEFAULT_VISITOR_ALIGN if no face
 * is found.
 */
export async function computeFaceAlign(
  image: HTMLImageElement,
  targetRatio: number,
): Promise<VisitorAlign> {
  const ratioKey = Math.round(targetRatio * 1000)
  let byRatio = alignCache.get(image)
  if (!byRatio) {
    byRatio = new Map()
    alignCache.set(image, byRatio)
  }
  const cached = byRatio.get(ratioKey)
  if (cached) return cached
  const pending = computeFaceAlignUncached(image, targetRatio)
  byRatio.set(ratioKey, pending)
  return pending
}

async function computeFaceAlignUncached(
  image: HTMLImageElement,
  targetRatio: number,
): Promise<VisitorAlign> {
  try {
    const landmarker = await getImageLandmarker()
    const result = landmarker.detect(image)
    const landmarks = result.faceLandmarks?.[0]
    const eyes = landmarks ? readEyeCenters(landmarks) : null
    if (!eyes) return { ...DEFAULT_VISITOR_ALIGN }

    const sourceWidth = image.naturalWidth || image.width
    const sourceHeight = image.naturalHeight || image.height
    const { sx, sy, sw, sh } = coverCropRect(sourceWidth, sourceHeight, targetRatio, FOCUS_Y)

    // Landmark position within the cropped region (0–1); can fall slightly
    // outside [0,1] if the crop excluded part of the face — that's fine,
    // the resulting align just leans further to compensate. MediaPipe's
    // landmark indices are subject-relative (its own left/right), not
    // screen-space — so sort by actual x instead of trusting which index
    // is "left": whichever lands further left on screen goes to
    // TARGET_LEFT_EYE, matching how the shard shapes are actually laid out.
    const pointA = { u: (eyes[0].x * sourceWidth - sx) / sw, v: (eyes[0].y * sourceHeight - sy) / sh }
    const pointB = { u: (eyes[1].x * sourceWidth - sx) / sw, v: (eyes[1].y * sourceHeight - sy) / sh }
    const [screenLeft, screenRight] = pointA.u <= pointB.u ? [pointA, pointB] : [pointB, pointA]
    return alignFromCropEyes(screenLeft, screenRight)
  } catch {
    return { ...DEFAULT_VISITOR_ALIGN }
  }
}
