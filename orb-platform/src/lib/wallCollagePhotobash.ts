import { facesMatching, type FaceBankFace, type FacePresentation, type FaceTagQuery } from './faceBank'
import type { CollageCue } from './collageCue'
import {
  DEFAULT_VISITOR_ALIGN,
  drawVisitorAligned,
  getWallMatchShards,
  mulberry32,
  normalizeVisitorAlign,
  type FaceShard,
  type VisitorAlign,
} from './wallMatchPhotobash'

/** collageRects() order after the mouth merge: eyes, nose, brow, cheeks,
 * chin, temple, then mouth last. Hair-adjacent pieces can follow a hair
 * colour cue; the mouth can follow smile. */
const HAIR_SLOT_INDICES = new Set([3, 7])

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
 * cut rectangular pieces rather than a seamless mosaic. Tiny seeded jitter
 * keeps them from looking like a spreadsheet without sliding features off
 * their shards. The mouth rect is always last — see mouthRectIndex(). */
export function collageRects(seed = 1, jitter = 0.02): CollageRect[] {
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

function omitKey<T extends FaceTagQuery>(query: T, key: keyof FaceTagQuery): FaceTagQuery {
  const next = { ...query }
  delete next[key]
  return next
}

function queryForSlot(cue: CollageCue, slotIndex: number, mouthIndex: number): FaceTagQuery {
  const query: FaceTagQuery = {}
  if (cue.presentations?.length) query.presentations = cue.presentations
  else if (cue.presentation) query.presentation = cue.presentation
  if (cue.ageBand) query.ageBand = cue.ageBand
  if (cue.hairColor && HAIR_SLOT_INDICES.has(slotIndex)) query.hairColor = cue.hairColor
  if (cue.smile !== undefined && slotIndex === mouthIndex) query.smile = cue.smile
  return query
}

function omitPresentation(query: FaceTagQuery): FaceTagQuery {
  const next = { ...query }
  delete next.presentation
  delete next.presentations
  return next
}

function relaxedQueries(query: FaceTagQuery, lockPresentation = false): FaceTagQuery[] {
  const steps: FaceTagQuery[] = [query]
  if (query.smile !== undefined) steps.push(omitKey(query, 'smile'))
  if (steps[steps.length - 1].hairColor) steps.push(omitKey(steps[steps.length - 1], 'hairColor'))
  if (steps[steps.length - 1].ageBand) steps.push(omitKey(steps[steps.length - 1], 'ageBand'))
  if (!lockPresentation && (query.presentation || query.presentations?.length)) {
    steps.push(omitPresentation(steps[steps.length - 1]))
  }
  return steps
}

/** Bank indices that may fill this collage slot for the visitor's cue. */
export function strangerPoolIndices(
  faces: FaceBankFace[],
  cue: CollageCue,
  slotIndex: number,
  mouthIndex: number,
): number[] {
  if (faces.length === 0) return []
  const lockPresentation = cue.lockPresentation === true
  for (const query of relaxedQueries(queryForSlot(cue, slotIndex, mouthIndex), lockPresentation)) {
    const hits = faces.flatMap((face, index) => (facesMatching([face], query).length ? [index] : []))
    if (hits.length > 0) return hits
  }
  if (lockPresentation) return []
  return faces.map((_, index) => index)
}

/** Same seed + cue always yields the same collage; missing cue stays uniform RNG. */
export function pickTaggedStrangerAssignments(
  seed: number,
  faces: FaceBankFace[],
  cue: CollageCue,
  rectCount: number,
  mouthIndex = rectCount - 1,
): number[] {
  if (faces.length === 0) return new Array(rectCount).fill(-1)
  const rand = mulberry32(seed)
  return Array.from({ length: rectCount }, (_, slot) => {
    const pool = strangerPoolIndices(faces, cue, slot, mouthIndex)
    if (pool.length === 0) return -1
    return pool[Math.floor(rand() * pool.length)]
  })
}

export type CollageTypeStats = {
  cue: CollageCue
  identityPool: number
  slotPools: number[]
  collages: number
}

export type CollageCombinationStats = {
  rectCount: number
  faces: number
  types: CollageTypeStats[]
  typeCount: number
  minCollages: number
  maxCollages: number
}

function product(values: number[]): number {
  return values.reduce((total, value) => total * Math.max(0, value), 1)
}

/** How many distinct 9-piece collages each identity × age × smile type can seed. */
export function collageCombinationStats(
  faces: FaceBankFace[],
  rectCount = 9,
): CollageCombinationStats {
  const presentationSets: FacePresentation[][] = [
    ['woman'],
    ['man'],
    ['androgynous'],
    ['woman', 'man', 'androgynous'],
  ]
  const types: CollageTypeStats[] = []
  for (const presentations of presentationSets) {
    for (const ageBand of ['young', 'mid'] as const) {
      for (const smile of [true, false]) {
        const cue: CollageCue = { presentations, ageBand, smile, lockPresentation: true }
        const identityPool = facesMatching(faces, { presentations, ageBand }).length
        if (identityPool === 0) continue
        const mouthIndex = rectCount - 1
        const slotPools = Array.from({ length: rectCount }, (_, slot) =>
          strangerPoolIndices(faces, cue, slot, mouthIndex).length,
        )
        types.push({
          cue,
          identityPool,
          slotPools,
          collages: product(slotPools),
        })
      }
    }
  }
  const collageCounts = types.map((type) => type.collages)
  return {
    rectCount,
    faces: faces.length,
    types,
    typeCount: types.length,
    minCollages: collageCounts.length ? Math.min(...collageCounts) : 0,
    maxCollages: collageCounts.length ? Math.max(...collageCounts) : 0,
  }
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

/** Identity-first reveal order for the visitor's pieces: both eyes, then
 * brow, nose and mouth, then the periphery. The eyes are the most
 * recognisable part of a face, so a short conversation still leaves the
 * recognisable core on the wall (and leads the printed ticket's partial
 * sweep). Deterministic -- no seed -- so all six wall windows agree with
 * no cross-window coordination. Relies on collageRects' fixed order:
 * right eye, left eye, nose, brow, cheeks, chin, temple, mouth last. */
export function anatomicalRevealOrder(rectCount: number): number[] {
  if (rectCount <= 0) return []
  const preferred = [0, 1, 3, 2, rectCount - 1, 5, 4, 7, 6]
  const order: number[] = []
  for (const index of preferred) {
    if (index >= 0 && index < rectCount && !order.includes(index)) order.push(index)
  }
  for (let index = 0; index < rectCount; index += 1) {
    if (!order.includes(index)) order.push(index)
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
  /** Continuous portrait underneath the cutouts for the physical wall. */
  fillBackground?: boolean
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
  if (options.fillBackground && bankImages.length > 0) {
    const index = Math.max(0, strangerAssignments[0] ?? 0) % bankImages.length
    drawVisitorAligned(ctx, bankImages[index], width, height, bankAligns[index] ?? DEFAULT_VISITOR_ALIGN)
  }

  rects.forEach((rect, index) => {
    const isRevealed = revealedCells.has(index)
    const isRevealing = options.revealingCell === index
    const bankIndex = strangerAssignments[index]
    const bankImage = bankIndex >= 0 ? bankImages[bankIndex % Math.max(1, bankImages.length)] : null
    const bankAlign = bankIndex >= 0 && bankAligns.length > 0 ? bankAligns[bankIndex % bankAligns.length] : null

    if (bankImage && bankAlign) {
      drawRectFromSource(ctx, rect, bankImage, bankAlign, width, height, 1)
    }

    if (visitorImage && isRevealed) {
      drawRectFromSource(ctx, rect, visitorImage, visitorAlign, width, height, 1)
    } else if (visitorImage && isRevealing) {
      drawRectFromSource(ctx, rect, visitorImage, visitorAlign, width, height, options.revealingOpacity ?? 0)
    }
  })

}

export { normalizeVisitorAlign }
export type { VisitorAlign }
