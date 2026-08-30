import { describe, expect, it } from 'vitest'
import { PHOTOBASH_FILL_MS } from './photobashLoop'
import { collageRects, mouthRectIndex } from './wallCollagePhotobash'
import {
  drawWallForming,
  FLESH_SWATCHES,
  FORMING_APPEAR_STEP_MS,
  FORMING_DURATION_MS,
  FORMING_PLATE_BG,
  FORMING_PULSE_MS,
  FORMING_SKELETON_MAX,
  FORMING_SKELETON_MIN,
  fleshFillForRect,
  formingAppearAt,
  formingAppearEndMs,
  formingAppearOrder,
  formingElapsedMs,
  formingTilePose,
  pickWallLoadingSurface,
  shouldShowForming,
  shouldShowFormingCaption,
} from './wallForming'

type FillCall = {
  fillStyle: string | CanvasGradient | CanvasPattern
  args: [number, number, number, number]
}

function recordingContext() {
  const fillCalls: FillCall[] = []
  const context = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
    clearRect() {},
    fillRect(...args: [number, number, number, number]) {
      fillCalls.push({ fillStyle: this.fillStyle, args })
    },
    strokeRect() {},
    save() {},
    restore() {},
    translate() {},
    scale() {},
    rotate() {},
  }
  return {
    ctx: context as unknown as CanvasRenderingContext2D,
    fillCalls,
  }
}

describe('drawWallForming', () => {
  it('paints only the first appearing tile at the start', () => {
    const width = 1000
    const height = 500
    const rects = collageRects(1)
    const order = formingAppearOrder(1, rects.length)
    const first = rects[order[0]]
    const { ctx, fillCalls } = recordingContext()

    drawWallForming(ctx, {
      width,
      height,
      rects,
      seed: 1,
      elapsedMs: 0,
    })

    expect(fillCalls[0]).toEqual({
      fillStyle: FORMING_PLATE_BG,
      args: [0, 0, width, height],
    })
    expect(fillCalls.slice(1)).toEqual([
      {
        fillStyle: fleshFillForRect(1, order[0]),
        args: [first.x * width, first.y * height, first.w * width, first.h * height],
      },
    ])
    expect(FORMING_PLATE_BG).toBe('#120d0a')
  })

  it('keeps every collage rectangle at its scaled coordinates after they have all landed', () => {
    const width = 1000
    const height = 500
    const rects = collageRects(1)
    const { ctx, fillCalls } = recordingContext()

    drawWallForming(ctx, {
      width,
      height,
      rects,
      seed: 1,
      elapsedMs: formingAppearEndMs(rects.length),
    })

    expect(fillCalls.slice(1).map(({ args }) => args)).toEqual(
      rects.map((rect) => [rect.x * width, rect.y * height, rect.w * width, rect.h * height]),
    )
  })
})

describe('wallForming', () => {
  it('keeps a bleak desaturated flesh list', () => {
    expect([...FLESH_SWATCHES]).toEqual([
      '#c5b8ae',
      '#a89b94',
      '#b7aaa0',
      '#8e827c',
      '#d2c8c0',
      '#9b8f88',
      '#b3a49c',
      '#7a706c',
      '#c8bdb4',
    ])
  })

  it('assigns the same swatch for the same seed and index', () => {
    expect(fleshFillForRect(7, 0)).toBe(fleshFillForRect(7, 0))
    expect(FLESH_SWATCHES).toContain(fleshFillForRect(7, 0))
  })

  it('maps loadingProgress onto the 4s fill clock', () => {
    expect(formingElapsedMs.length).toBe(1)
    expect(formingElapsedMs(0)).toBe(0)
    expect(formingElapsedMs(0.5)).toBe(PHOTOBASH_FILL_MS / 2)
    expect(formingElapsedMs(1)).toBe(PHOTOBASH_FILL_MS)
    expect(formingElapsedMs(2)).toBe(PHOTOBASH_FILL_MS)
    expect(formingElapsedMs(-1)).toBe(0)
  })

  it('reveals tiles slowly, one by one, with the mouth last', () => {
    const rects = collageRects(1)
    const order = formingAppearOrder(1, rects.length)
    expect(order).toEqual(formingAppearOrder(1, rects.length))
    expect(new Set(order)).toEqual(new Set(rects.map((_, index) => index)))
    expect(order[order.length - 1]).toBe(mouthRectIndex(rects))
    expect(FORMING_APPEAR_STEP_MS).toBeGreaterThanOrEqual(280)
    expect(formingAppearAt(0)).toBe(0)
    expect(formingAppearAt(1)).toBe(FORMING_APPEAR_STEP_MS)
    expect(formingAppearEndMs(rects.length)).toBe((rects.length - 1) * FORMING_APPEAR_STEP_MS)
    expect(formingAppearEndMs(rects.length)).toBeLessThan(FORMING_DURATION_MS)
  })

  it('keeps a tile on once it has appeared', () => {
    const rects = collageRects(1)
    const order = formingAppearOrder(1, rects.length)
    const first = order[0]
    const last = order[order.length - 1]
    const beforeLast = formingAppearAt(order.length - 1) - 1
    const afterLast = formingAppearAt(order.length - 1)
    const late = FORMING_DURATION_MS - 1

    expect(formingTilePose(1, first, rects[first], 0, rects.length).opacity).toBeGreaterThan(0)
    expect(formingTilePose(1, last, rects[last], beforeLast, rects.length).opacity).toBe(0)
    expect(formingTilePose(1, last, rects[last], afterLast, rects.length).opacity).toBeGreaterThan(0)
    expect(formingTilePose(1, first, rects[first], late, rects.length).opacity).toBeGreaterThan(0)
    expect(formingTilePose(1, last, rects[last], late, rects.length).opacity).toBeGreaterThan(0)
  })

  it('stays solid while tiles are still appearing, then pulses together', () => {
    const rects = collageRects(1)
    const appearEnd = formingAppearEndMs(rects.length)
    const midAppear = appearEnd / 2
    const during = rects.map((rect, index) => formingTilePose(1, index, rect, midAppear, rects.length))
    const visible = during.filter((pose) => pose.opacity > 0)
    expect(visible.length).toBeGreaterThan(0)
    expect(visible.length).toBeLessThan(rects.length)
    visible.forEach((pose) => expect(pose.opacity).toBe(1))

    const pulseA = appearEnd
    const pulseB = appearEnd + FORMING_PULSE_MS / 2
    const opacitiesA = rects.map((rect, index) => formingTilePose(1, index, rect, pulseA, rects.length).opacity)
    const opacitiesB = rects.map((rect, index) => formingTilePose(1, index, rect, pulseB, rects.length).opacity)
    expect(new Set(opacitiesA).size).toBe(1)
    expect(new Set(opacitiesB).size).toBe(1)
    expect(opacitiesA[0]).toBe(FORMING_SKELETON_MAX)
    expect(opacitiesB[0]).toBeCloseTo(FORMING_SKELETON_MIN, 5)
    expect(opacitiesA[0]).not.toBeCloseTo(opacitiesB[0], 2)
    expect(FORMING_DURATION_MS).toBe(PHOTOBASH_FILL_MS)
  })

  it('keeps every visible tile on its collage rect', () => {
    const rects = collageRects(1)
    const order = formingAppearOrder(1, rects.length)
    const target = rects[order[0]]
    const mid = formingTilePose(1, order[0], target, 80, rects.length)
    const landed = formingTilePose(1, order[0], target, FORMING_DURATION_MS, rects.length)
    expect(mid).toMatchObject({ ...target, rotation: 0 })
    expect(landed).toMatchObject({ ...target, rotation: 0 })
    expect(mid.opacity).toBeGreaterThan(0)
    expect(landed.opacity).toBeGreaterThan(0)
  })

  it('shows forming only while the fill clock is running', () => {
    expect(shouldShowForming(0)).toBe(true)
    expect(shouldShowForming(0.99)).toBe(true)
    expect(shouldShowForming(1)).toBe(false)
  })

  it('keeps forming copy off every wall role', () => {
    expect(shouldShowFormingCaption('debra')).toBe(false)
    expect(shouldShowFormingCaption(null)).toBe(false)
    expect(shouldShowFormingCaption('copy')).toBe(false)
  })

  it('picks forming, collage, or the old face blanket from collage+progress', () => {
    expect(pickWallLoadingSurface(false, 0)).toBe('face')
    expect(pickWallLoadingSurface(false, 1)).toBe('face')
    expect(pickWallLoadingSurface(true, 0)).toBe('forming')
    expect(pickWallLoadingSurface(true, 0.5)).toBe('forming')
    expect(pickWallLoadingSurface(true, 1)).toBe('collage')
    expect(pickWallLoadingSurface(true, 1, false)).toBe('forming')
    expect(pickWallLoadingSurface(true, 1, true)).toBe('collage')
  })
})
