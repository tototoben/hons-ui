import {
  DEFAULT_VISITOR_ALIGN,
  drawVisitorAligned,
  getWallMatchShards,
  mulberry32,
  normalizeVisitorAlign,
  type FaceShard,
  type VisitorAlign,
} from './wallMatchPhotobash'

export type CollageRect = { x: number; y: number; w: number; h: number }

function shardBounds(shard: FaceShard): CollageRect {
  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0
  shard.forEach(([x, y]) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  })
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** Indices into the raw 11-shard pool for "right half mouth", "left half
 * mouth", and "philtrum/upper lip" — see the comments in wallMatchPhotobash's
 * SHARD_POOL for the full ordering. These three sit right on top of each
 * other, so they're merged into a single mouth rect below rather than kept
 * as three separate pieces — otherwise the lip-sprite overlay only covers
 * part of that area and the real cropped-photo mouth still peeks out
 * around it, reading as two mouths. */
const MOUTH_MERGE_INDICES = [3, 4, 9]
/** The raw union of the three merged shards reads much wider than any
 * other single piece; shrink it toward its own center so it's proportionate. */
const MOUTH_INSET = 0.55

function boundsUnion(rects: CollageRect[]): CollageRect {
  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0
  rects.forEach((rect) => {
    minX = Math.min(minX, rect.x)
    minY = Math.min(minY, rect.y)
    maxX = Math.max(maxX, rect.x + rect.w)
    maxY = Math.max(maxY, rect.y + rect.h)
  })
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** Axis-aligned rectangle for each of the hand-tuned eye/nose/cheek/brow/
 * chin/temple zones (bounding box of the original organic shard shapes),
 * plus one merged, size-corrected mouth rect — combined with per-image
 * face alignment, a piece reliably shows the right anatomy no matter which
 * of the differently-framed bank photos fills it, while still reading as
 * cut rectangular pieces rather than a seamless mosaic. A little seeded
 * jitter keeps them from looking like a perfect spreadsheet. The mouth
 * rect is always last — see mouthRectIndex(). */
export function collageRects(seed = 1, jitter = 0.08): CollageRect[] {
  const rand = mulberry32(seed)
  const bounds = getWallMatchShards().map(shardBounds)
  const nonMouth = bounds.filter((_, index) => !MOUTH_MERGE_INDICES.includes(index))
  const mouthUnion = boundsUnion(MOUTH_MERGE_INDICES.map((index) => bounds[index]))
  const mouthRect: CollageRect = {
    x: mouthUnion.x + (mouthUnion.w * (1 - MOUTH_INSET)) / 2,
    y: mouthUnion.y + (mouthUnion.h * (1 - MOUTH_INSET)) / 2,
    w: mouthUnion.w * MOUTH_INSET,
    h: mouthUnion.h * MOUTH_INSET,
  }

  return [...nonMouth, mouthRect].map((rect) => {
    const jx = (rand() - 0.5) * jitter * rect.w
    const jy = (rand() - 0.5) * jitter * rect.h
    const jw = 1 + (rand() - 0.5) * jitter
    const jh = 1 + (rand() - 0.5) * jitter
    return {
      x: rect.x + jx,
      y: rect.y + jy,
      w: rect.w * jw,
      h: rect.h * jh,
    }
  })
}

/** The merged mouth rect is always appended last by collageRects(). */
export function mouthRectIndex(rects: CollageRect[]): number {
  return rects.length - 1
}

/** Seeded per-rect pick of which bank image supplies that piece. */
export function pickStrangerAssignments(seed: number, rectCount: number, bankSize: number): number[] {
  if (bankSize <= 0) return new Array(rectCount).fill(-1)
  const rand = mulberry32(seed)
  return Array.from({ length: rectCount }, () => Math.floor(rand() * bankSize))
}

/** Seeded shuffle of rect indices — the order pieces flip to the visitor. */
export function visitorRevealOrder(seed: number, rectCount: number): number[] {
  const rand = mulberry32(seed)
  const order = Array.from({ length: rectCount }, (_, index) => index)
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/** Same shape as wallMatchPhotobash's photobashRevealAt — how many rects
 * (in reveal order) are now the visitor's, plus fade-in for the next one. */
export function collageRevealAt(elapsedMs: number, totalMs: number, rectCount: number) {
  const total = Math.max(1, rectCount)
  const progress = Math.max(0, Math.min(1, elapsedMs / totalMs))
  const exact = progress * total
  const revealedCount = Math.min(total, Math.floor(exact))
  const nextOpacity = revealedCount >= total ? 0 : Math.max(0, Math.min(1, exact - revealedCount))
  return { revealedCount, nextOpacity, progress }
}

type ImageLike = CanvasImageSource & { width: number; height: number; naturalWidth?: number; naturalHeight?: number }

function drawRectFromSource(
  ctx: CanvasRenderingContext2D,
  rect: CollageRect,
  image: ImageLike,
  align: VisitorAlign,
  width: number,
  height: number,
  opacity: number,
) {
  if (opacity <= 0) return
  ctx.save()
  ctx.beginPath()
  ctx.rect(rect.x * width, rect.y * height, rect.w * width, rect.h * height)
  ctx.clip()
  ctx.globalAlpha = opacity
  drawVisitorAligned(ctx, image, width, height, align)
  ctx.restore()
}

export type CollageComposeOptions = {
  width: number
  height: number
  rects: CollageRect[]
  bankImages: ImageLike[]
  bankAligns: VisitorAlign[]
  strangerAssignments: number[]
  visitorImage: ImageLike | null
  visitorAlign?: VisitorAlign
  /** Rect indices already fully swapped to the visitor. */
  revealedCells: ReadonlySet<number>
  /** Rect index mid-swap this frame (visitor piece fading in), or null. */
  revealingCell?: number | null
  revealingOpacity?: number
}

/**
 * Draws the full collage into an existing canvas (caller owns the canvas so
 * it can be re-drawn every frame without re-allocating). Stranger pieces
 * fill every rect first; revealedCells swap in the matching visitor crop.
 * The lip-sprite overlay (drawn separately by the caller) sits exactly on
 * top of the mouth rect at mouthRectIndex() — this still draws it normally
 * like any other piece, so the static mouth shows through whenever the
 * sprite layer is transparent (between talking bursts).
 */
export function drawWallCollage(ctx: CanvasRenderingContext2D, options: CollageComposeOptions) {
  const { width, height, rects, bankImages, bankAligns, strangerAssignments, visitorImage, revealedCells } =
    options
  const visitorAlign = options.visitorAlign ?? DEFAULT_VISITOR_ALIGN

  ctx.clearRect(0, 0, width, height)

  rects.forEach((rect, index) => {
    const isRevealed = revealedCells.has(index)
    const isRevealing = options.revealingCell === index
    const bankIndex = strangerAssignments[index]
    const bankImage = bankIndex >= 0 ? bankImages[bankIndex % Math.max(1, bankImages.length)] : null
    const bankAlign = bankIndex >= 0 ? bankAligns[bankIndex % Math.max(1, bankAligns.length)] : null

    if (bankImage && bankAlign) {
      drawRectFromSource(ctx, rect, bankImage, bankAlign, width, height, 1)
    }

    if (visitorImage && isRevealed) {
      drawRectFromSource(ctx, rect, visitorImage, visitorAlign, width, height, 1)
    } else if (visitorImage && isRevealing) {
      drawRectFromSource(ctx, rect, visitorImage, visitorAlign, width, height, options.revealingOpacity ?? 0)
    }
  })

  // Faint rect outlines for photobash texture.
  ctx.save()
  ctx.strokeStyle = 'rgba(8, 6, 4, 0.35)'
  ctx.lineWidth = Math.max(1, width * 0.0015)
  rects.forEach((rect) => {
    ctx.strokeRect(rect.x * width, rect.y * height, rect.w * width, rect.h * height)
  })
  ctx.restore()
}

export { normalizeVisitorAlign }
export type { VisitorAlign }
