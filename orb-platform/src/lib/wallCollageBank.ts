import { useEffect, useState } from 'react'
import { loadFaceBankImages } from './faceBank'
import { computeFaceAlign } from './faceBankAlign'
import { collageRects, pickStrangerAssignments } from './wallCollagePhotobash'
import { DEFAULT_VISITOR_ALIGN, MATCH_FACE_SIZE, type VisitorAlign } from './wallMatchPhotobash'
import { LIP_SPRITE_SRC } from './wallLipClips'

export type CollageBank = {
  images: HTMLImageElement[]
  aligns: VisitorAlign[]
}

const PLATE_RATIO = MATCH_FACE_SIZE.width / MATCH_FACE_SIZE.height
const ready = new Map<number, CollageBank>()
const inflight = new Map<number, Promise<CollageBank>>()

function nextPaint() {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve())
      return
    }
    resolve()
  })
}

function prefetchLipSprite() {
  if (typeof Image === 'undefined') return
  const image = new Image()
  image.decoding = 'async'
  image.src = LIP_SPRITE_SRC
}

export function collageAlignIndices(seed: number, bankSize: number): number[] {
  if (bankSize <= 0) return []
  const assignments = pickStrangerAssignments(seed, collageRects(seed).length, bankSize)
  return [...new Set(assignments.filter((index) => index >= 0))]
}

export function peekCollageBank(seed: number): CollageBank | null {
  return ready.get(seed) ?? null
}

export function resetCollageBankCache() {
  ready.clear()
  inflight.clear()
}

export async function prefetchCollageAssets() {
  prefetchLipSprite()
  return loadFaceBankImages()
}

export async function ensureCollageBank(
  seed: number,
  yieldFrame: () => Promise<void> = nextPaint,
): Promise<CollageBank> {
  const cached = ready.get(seed)
  if (cached) return cached
  const existing = inflight.get(seed)
  if (existing) return existing
  const pending = warmCollageBank(seed, yieldFrame)
    .then((bank) => {
      ready.set(seed, bank)
      inflight.delete(seed)
      return bank
    })
    .catch((error) => {
      inflight.delete(seed)
      throw error
    })
  inflight.set(seed, pending)
  return pending
}

async function warmCollageBank(
  seed: number,
  yieldFrame: () => Promise<void>,
): Promise<CollageBank> {
  const images = await prefetchCollageAssets()
  const aligns = images.map(() => ({ ...DEFAULT_VISITOR_ALIGN }))
  for (const index of collageAlignIndices(seed, images.length)) {
    aligns[index] = await computeFaceAlign(images[index], PLATE_RATIO)
    await yieldFrame()
  }
  return { images, aligns }
}

export function useCollageBankReady(seed: number, startAlign = true) {
  const [bankReady, setBankReady] = useState(() => peekCollageBank(seed) != null)

  useEffect(() => {
    void prefetchCollageAssets()
  }, [seed])

  useEffect(() => {
    let cancelled = false
    if (peekCollageBank(seed)) {
      setBankReady(true)
      return
    }
    if (!startAlign) {
      setBankReady(false)
      return
    }
    void ensureCollageBank(seed).then(() => {
      if (!cancelled) setBankReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [seed, startAlign])

  return bankReady
}
