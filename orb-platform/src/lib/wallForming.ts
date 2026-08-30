import { PHOTOBASH_FILL_MS } from './photobashLoop'
import { type CollageRect } from './wallCollagePhotobash'
import { mulberry32 } from './wallMatchPhotobash'
import type { WallRole } from './wallRole'

export const FLESH_SWATCHES = [
  '#c5b8ae',
  '#a89b94',
  '#b7aaa0',
  '#8e827c',
  '#d2c8c0',
  '#9b8f88',
  '#b3a49c',
  '#7a706c',
  '#c8bdb4',
] as const

export const FORMING_PLATE_BG = '#120d0a'
export const FORMING_APPEAR_STEP_MS = 300
export const FORMING_PULSE_MS = 1200
export const FORMING_DURATION_MS = PHOTOBASH_FILL_MS
export const FORMING_SKELETON_MIN = 0.42
export const FORMING_SKELETON_MAX = 1

export type FormingPose = CollageRect & {
  rotation: number
  opacity: number
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

export function fleshFillForRect(seed: number, index: number): string {
  const rand = mulberry32((seed + 3 + index * 19) >>> 0)
  return FLESH_SWATCHES[Math.floor(rand() * FLESH_SWATCHES.length)]
}

export function formingElapsedMs(loadingProgress: number) {
  return clamp01(loadingProgress) * PHOTOBASH_FILL_MS
}

export function formingAppearOrder(seed: number, rectCount: number): number[] {
  const rand = mulberry32((seed + 11) >>> 0)
  const rest = Array.from({ length: Math.max(0, rectCount - 1) }, (_, index) => index)
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return rectCount > 0 ? [...rest, rectCount - 1] : []
}

export function formingAppearAt(orderIndex: number) {
  return Math.max(0, orderIndex) * FORMING_APPEAR_STEP_MS
}

export function formingAppearEndMs(rectCount: number) {
  return formingAppearAt(Math.max(0, rectCount - 1))
}

export function formingPulseOpacity(elapsedMs: number, rectCount: number) {
  const appearEnd = formingAppearEndMs(rectCount)
  if (elapsedMs < appearEnd) return FORMING_SKELETON_MAX
  const wave = 0.5 + 0.5 * Math.cos(((elapsedMs - appearEnd) / FORMING_PULSE_MS) * Math.PI * 2)
  return FORMING_SKELETON_MIN + (FORMING_SKELETON_MAX - FORMING_SKELETON_MIN) * wave
}

export function shouldShowForming(loadingProgress: number) {
  return formingElapsedMs(loadingProgress) < FORMING_DURATION_MS
}

export function shouldShowFormingCaption(_role: WallRole | null) {
  return false
}

export function pickWallLoadingSurface(
  collage: boolean,
  loadingProgress: number,
  collageReady = true,
): 'forming' | 'collage' | 'face' {
  if (!collage) return 'face'
  if (shouldShowForming(loadingProgress) || !collageReady) return 'forming'
  return 'collage'
}

export function formingTilePose(
  seed: number,
  index: number,
  target: CollageRect,
  elapsedMs: number,
  rectCount: number,
): FormingPose {
  const order = formingAppearOrder(seed, rectCount)
  const orderIndex = order.indexOf(index)
  const visible = orderIndex >= 0 && elapsedMs >= formingAppearAt(orderIndex)
  return {
    ...target,
    rotation: 0,
    opacity: visible ? formingPulseOpacity(elapsedMs, rectCount) : 0,
  }
}

export type DrawWallFormingOptions = {
  width: number
  height: number
  rects: CollageRect[]
  seed: number
  elapsedMs: number
}

function drawPose(
  ctx: CanvasRenderingContext2D,
  pose: FormingPose,
  fill: string,
  width: number,
  height: number,
) {
  const x = pose.x * width
  const y = pose.y * height
  const w = pose.w * width
  const h = pose.h * height
  if (w <= 0.5 || h <= 0.5 || pose.opacity <= 0) return
  ctx.save()
  ctx.globalAlpha = pose.opacity
  ctx.fillStyle = fill
  ctx.fillRect(x, y, w, h)
  ctx.restore()
}

export function drawWallForming(
  ctx: CanvasRenderingContext2D,
  { width, height, rects, seed, elapsedMs }: DrawWallFormingOptions,
) {
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = FORMING_PLATE_BG
  ctx.fillRect(0, 0, width, height)

  rects.forEach((rect, index) => {
    const pose = formingTilePose(seed, index, rect, elapsedMs, rects.length)
    drawPose(ctx, pose, fleshFillForRect(seed, index), width, height)
  })

  ctx.save()
  ctx.strokeStyle = 'rgba(8, 6, 4, 0.32)'
  ctx.lineWidth = Math.max(1, width * 0.0015)
  rects.forEach((rect, index) => {
    const pose = formingTilePose(seed, index, rect, elapsedMs, rects.length)
    if (pose.opacity <= 0) return
    ctx.globalAlpha = pose.opacity
    ctx.strokeRect(rect.x * width, rect.y * height, rect.w * width, rect.h * height)
  })
  ctx.restore()
}
