import { describe, expect, it } from 'vitest'
import { PHOTOBASH_FILL_MS } from './photobashLoop'
import { collageRects } from './wallCollagePhotobash'
import {
  FLESH_SWATCHES,
  FORMING_COPY,
  FORMING_FROM_SCALE,
  FORMING_STAGGER_MS,
  FORMING_TILE_MS,
  fleshFillForRect,
  formingElapsedMs,
  formingStagger,
  formingTileOpacity,
  formingTileScale,
  pickWallLoadingSurface,
  shouldShowForming,
  shouldShowFormingCaption,
} from './wallForming'

describe('wallForming', () => {
  it('keeps the locked mixed-bruise swatch list', () => {
    expect([...FLESH_SWATCHES]).toEqual([
      '#e8b48c',
      '#c97a6e',
      '#d4a574',
      '#8e5a58',
      '#f0c4b0',
      '#a07068',
      '#d4927a',
      '#b86b5c',
      '#c4a080',
    ])
  })

  it('uses PARTNER FORMING as the only forming copy', () => {
    expect(FORMING_COPY).toBe('PARTNER FORMING')
  })

  it('assigns the same swatch for the same seed and index', () => {
    expect(fleshFillForRect(7, 0)).toBe(fleshFillForRect(7, 0))
    expect(FLESH_SWATCHES).toContain(fleshFillForRect(7, 0))
  })

  it('staggers every rect inside the 2500ms window, stably', () => {
    const rects = collageRects(1)
    const a = formingStagger(1, rects.length)
    const b = formingStagger(1, rects.length)
    expect(a).toEqual(b)
    expect(a).toHaveLength(rects.length)
    expect(new Set(a).size).toBe(rects.length)
    a.forEach((delay) => {
      expect(delay).toBeGreaterThanOrEqual(0)
      expect(delay).toBeLessThanOrEqual(FORMING_STAGGER_MS)
    })
    expect(Math.min(...a)).toBe(0)
    expect(Math.max(...a)).toBe(FORMING_STAGGER_MS)
  })

  it('maps loadingProgress onto the 4s fill clock', () => {
    expect(formingElapsedMs(0)).toBe(0)
    expect(formingElapsedMs(0.5)).toBe(PHOTOBASH_FILL_MS / 2)
    expect(formingElapsedMs(1)).toBe(PHOTOBASH_FILL_MS)
    expect(formingElapsedMs(2)).toBe(PHOTOBASH_FILL_MS)
    expect(formingElapsedMs(-1)).toBe(0)
  })

  it('keeps a tile invisible before its delay and settled after the ease', () => {
    expect(formingTileOpacity(0, 1000)).toBe(0)
    expect(formingTileOpacity(1000, 1000)).toBe(0)
    expect(formingTileOpacity(1000 + FORMING_TILE_MS, 1000)).toBe(1)
    expect(formingTileScale(0, 1000)).toBe(FORMING_FROM_SCALE)
    expect(formingTileScale(1000 + FORMING_TILE_MS, 1000)).toBe(1)
  })

  it('shows forming only while progress is below 1', () => {
    expect(shouldShowForming(0)).toBe(true)
    expect(shouldShowForming(0.99)).toBe(true)
    expect(shouldShowForming(1)).toBe(false)
  })

  it('shows the caption on Debra and on a null Photobash role only', () => {
    expect(shouldShowFormingCaption('debra')).toBe(true)
    expect(shouldShowFormingCaption(null)).toBe(true)
    expect(shouldShowFormingCaption('copy')).toBe(false)
    expect(shouldShowFormingCaption('guide')).toBe(false)
    expect(shouldShowFormingCaption('code')).toBe(false)
    expect(shouldShowFormingCaption('status')).toBe(false)
    expect(shouldShowFormingCaption('avatar')).toBe(false)
  })

  it('picks forming, collage, or the old face blanket from collage+progress', () => {
    expect(pickWallLoadingSurface(false, 0)).toBe('face')
    expect(pickWallLoadingSurface(false, 1)).toBe('face')
    expect(pickWallLoadingSurface(true, 0)).toBe('forming')
    expect(pickWallLoadingSurface(true, 0.5)).toBe('forming')
    expect(pickWallLoadingSurface(true, 1)).toBe('collage')
  })
})
