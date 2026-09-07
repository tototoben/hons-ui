import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FACE_TAGS, type FaceBankFace } from './faceBank'
import { collageRects, pickTaggedStrangerAssignments } from './wallCollagePhotobash'
import { collageAlignIndices, ensureCollageBank, prefetchCollageAssets, resetCollageBankCache } from './wallCollageBank'

const dummyFace = (index: number): FaceBankFace => ({
  ...DEFAULT_FACE_TAGS,
  file: `${index}.jpg`,
})

const computeFaceAlign = vi.hoisted(() => vi.fn(async () => ({ scale: 1.4, offsetX: 0, offsetY: 0 })))
const loadFaceBankEntries = vi.hoisted(() =>
  vi.fn(async () =>
    Array.from({ length: 12 }, (_, index) => ({
      face: dummyFace(index),
      image: { width: 8, height: 8 } as HTMLImageElement,
    })),
  ),
)
const loadFaceBankImages = vi.hoisted(() =>
  vi.fn(async () => Array.from({ length: 12 }, () => ({ width: 8, height: 8 }) as HTMLImageElement)),
)

vi.mock('./faceBank', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./faceBank')>()
  return {
    ...actual,
    loadFaceBankEntries: (...args: unknown[]) => loadFaceBankEntries(...args),
    loadFaceBankImages: (...args: unknown[]) => loadFaceBankImages(...args),
  }
})

vi.mock('./faceBankAlign', () => ({
  computeFaceAlign: (...args: unknown[]) => computeFaceAlign(...args),
}))

describe('wallCollageBank', () => {
  beforeEach(() => {
    computeFaceAlign.mockClear()
    loadFaceBankEntries.mockClear()
    loadFaceBankImages.mockClear()
    resetCollageBankCache()
  })

  it('only aligns the bank photos this collage seed actually shows', async () => {
    const faces = Array.from({ length: 12 }, (_, index) => dummyFace(index))
    const needed = collageAlignIndices(4, faces)
    const assignments = pickTaggedStrangerAssignments(4, faces, {}, collageRects(4).length)
    expect(new Set(needed)).toEqual(new Set(assignments.filter((index) => index >= 0)))
    expect(needed.length).toBeGreaterThan(0)
    expect(needed.length).toBeLessThanOrEqual(collageRects(4).length)

    const bank = await ensureCollageBank(4, {}, async () => {})
    expect(bank.images).toHaveLength(12)
    expect(bank.faces).toHaveLength(12)
    expect(bank.aligns).toHaveLength(12)
    expect(computeFaceAlign).toHaveBeenCalledTimes(needed.length)
  })

  it('prefetches bank images without running face align', async () => {
    await prefetchCollageAssets()
    expect(loadFaceBankImages).toHaveBeenCalled()
    expect(computeFaceAlign).not.toHaveBeenCalled()
  })
})
