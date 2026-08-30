import { PHOTOBASH_FILL_MS } from './photobashLoop'
import { visitorRevealOrder, type CollageRect } from './wallCollagePhotobash'
import type { WallRole } from './wallRole'

export const FLESH_SWATCHES = [
  '#e8b48c',
  '#c97a6e',
  '#d4a574',
  '#8e5a58',
  '#f0c4b0',
  '#a07068',
  '#d4927a',
  '#b86b5c',
  '#c4a080',
] as const

export const FORMING_COPY = 'PARTNER FORMING'
export const FORMING_STAGGER_MS = 2500
export const FORMING_TILE_MS = 600
export const FORMING_FROM_SCALE = 0.96
export const FORMING_PLATE_BG = '#120d0a'

export function fleshFillForRect(seed: number, index: number): string {
  const order = visitorRevealOrder(seed + 3, FLESH_SWATCHES.length)
  return FLESH_SWATCHES[order[index % order.length]]
}

export function formingStagger(seed: number, rectCount: number): number[] {
  const order = visitorRevealOrder(seed + 17, rectCount)
  const last = Math.max(1, rectCount - 1)
  const delays = new Array<number>(rectCount)
  order.forEach((rectIndex, rank) => {
    delays[rectIndex] = (rank / last) * FORMING_STAGGER_MS
  })
  return delays
}

export function formingElapsedMs(loadingProgress: number, fillMs: number = PHOTOBASH_FILL_MS) {
  return Math.max(0, Math.min(1, loadingProgress)) * fillMs
}

export function formingTileOpacity(elapsedMs: number, delayMs: number) {
  return Math.max(0, Math.min(1, (elapsedMs - delayMs) / FORMING_TILE_MS))
}

export function formingTileScale(elapsedMs: number, delayMs: number) {
  const t = formingTileOpacity(elapsedMs, delayMs)
  return FORMING_FROM_SCALE + (1 - FORMING_FROM_SCALE) * t
}

export function shouldShowForming(loadingProgress: number) {
  return loadingProgress < 1
}

export function shouldShowFormingCaption(role: WallRole | null) {
  return role === 'debra' || role === null
}

export function pickWallLoadingSurface(
  collage: boolean,
  loadingProgress: number,
): 'forming' | 'collage' | 'face' {
  if (!collage) return 'face'
  return shouldShowForming(loadingProgress) ? 'forming' : 'collage'
}

export type DrawWallFormingOptions = {
  width: number
  height: number
  rects: CollageRect[]
  seed: number
  elapsedMs: number
}

export function drawWallForming(
  ctx: CanvasRenderingContext2D,
  { width, height, rects, seed, elapsedMs }: DrawWallFormingOptions,
) {
  const delays = formingStagger(seed, rects.length)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = FORMING_PLATE_BG
  ctx.fillRect(0, 0, width, height)

  rects.forEach((rect, index) => {
    const opacity = formingTileOpacity(elapsedMs, delays[index])
    if (opacity <= 0) return
    const scale = formingTileScale(elapsedMs, delays[index])
    const x = rect.x * width
    const y = rect.y * height
    const w = rect.w * width
    const h = rect.h * height
    const cx = x + w / 2
    const cy = y + h / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    ctx.translate(-cx, -cy)
    ctx.globalAlpha = opacity
    ctx.fillStyle = fleshFillForRect(seed, index)
    ctx.fillRect(x, y, w, h)
    ctx.restore()
  })

  ctx.save()
  ctx.strokeStyle = 'rgba(8, 6, 4, 0.35)'
  ctx.lineWidth = Math.max(1, width * 0.0015)
  rects.forEach((rect, index) => {
    const opacity = formingTileOpacity(elapsedMs, delays[index])
    if (opacity <= 0) return
    ctx.globalAlpha = opacity
    ctx.strokeRect(rect.x * width, rect.y * height, rect.w * width, rect.h * height)
  })
  ctx.restore()
}
