import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collageRects, pickStrangerAssignments } from './wallCollagePhotobash'
import { collageAlignIndices, ensureCollageBank, prefetchCollageAssets, resetCollageBankCache } from './wallCollageBank'

const computeFaceAlign = vi.hoisted(() => vi.fn(async () => ({ scale: 1.4, offsetX: 0, offsetY: 0 })))
const loadFaceBankImages = vi.hoisted(() =>
  vi.fn(async () => Array.from({ length: 12 }, () => ({ width: 8, height: 8 }) as HTMLImageElement)),
)

vi.mock('./faceBank', () => ({
  loadFaceBankImages: (...args: unknown[]) => loadFaceBankImages(...args),
}))

vi.mock('./faceBankAlign', () => ({
  computeFaceAlign: (...args: unknown[]) => computeFaceAlign(...args),
}))

describe('wallCollageBank', () => {
  beforeEach(() => {
    computeFaceAlign.mockClear()
    loadFaceBankImages.mockClear()
    resetCollageBankCache()
  })

  it('only aligns the bank photos this collage seed actually shows', async () => {
    const needed = collageAlignIndices(4, 12)
    const assignments = pickStrangerAssignments(4, collageRects(4).length, 12)
    expect(new Set(needed)).toEqual(new Set(assignments.filter((index) => index >= 0)))
    expect(needed.length).toBeGreaterThan(0)
    expect(needed.length).toBeLessThanOrEqual(collageRects(4).length)

    const bank = await ensureCollageBank(4, async () => {})
    expect(bank.images).toHaveLength(12)
    expect(bank.aligns).toHaveLength(12)
    expect(computeFaceAlign).toHaveBeenCalledTimes(needed.length)
  })

  it('prefetches bank images without running face align', async () => {
    await prefetchCollageAssets()
    expect(loadFaceBankImages).toHaveBeenCalled()
    expect(computeFaceAlign).not.toHaveBeenCalled()
  })
})
