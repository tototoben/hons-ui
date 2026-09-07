import { useEffect, useState } from 'react'
import { collageCueKey, type CollageCue } from './collageCue'
import { loadFaceBankEntries, loadFaceBankImages, type FaceBankFace } from './faceBank'
import { computeFaceAlign } from './faceBankAlign'
import { collageRects, pickTaggedStrangerAssignments } from './wallCollagePhotobash'
import { DEFAULT_VISITOR_ALIGN, MATCH_FACE_SIZE, type VisitorAlign } from './wallMatchPhotobash'
import { LIP_SPRITE_SRC } from './wallLipClips'

export type CollageBank = {
  images: HTMLImageElement[]
  aligns: VisitorAlign[]
  faces: FaceBankFace[]
}

const PLATE_RATIO = MATCH_FACE_SIZE.width / MATCH_FACE_SIZE.height
const ready = new Map<string, CollageBank>()
const inflight = new Map<string, Promise<CollageBank>>()

function bankKey(seed: number, cue: CollageCue) {
  return `${seed}:${collageCueKey(cue)}`
}

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

export function collageAlignIndices(seed: number, faces: FaceBankFace[], cue: CollageCue = {}): number[] {
  if (faces.length === 0) return []
  const assignments = pickTaggedStrangerAssignments(seed, faces, cue, collageRects(seed).length)
  return [...new Set(assignments.filter((index) => index >= 0))]
}

export function peekCollageBank(seed: number, cue: CollageCue = {}): CollageBank | null {
  return ready.get(bankKey(seed, cue)) ?? null
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
  cue: CollageCue = {},
  yieldFrame: () => Promise<void> = nextPaint,
): Promise<CollageBank> {
  const key = bankKey(seed, cue)
  const cached = ready.get(key)
  if (cached) return cached
  const existing = inflight.get(key)
  if (existing) return existing
  const pending = warmCollageBank(seed, cue, yieldFrame)
    .then((bank) => {
      ready.set(key, bank)
      inflight.delete(key)
      return bank
    })
    .catch((error) => {
      inflight.delete(key)
      throw error
    })
  inflight.set(key, pending)
  return pending
}

async function warmCollageBank(
  seed: number,
  cue: CollageCue,
  yieldFrame: () => Promise<void>,
): Promise<CollageBank> {
  const entries = await loadFaceBankEntries()
  const images = entries.map((entry) => entry.image)
  const faces = entries.map((entry) => entry.face)
  const aligns = images.map(() => ({ ...DEFAULT_VISITOR_ALIGN }))
  for (const index of collageAlignIndices(seed, faces, cue)) {
    aligns[index] = await computeFaceAlign(images[index], PLATE_RATIO)
    await yieldFrame()
  }
  return { images, aligns, faces }
}

export function useCollageBankReady(seed: number, startAlign = true, cue: CollageCue = {}) {
  const cueKey = collageCueKey(cue)
  const [bankReady, setBankReady] = useState(() => peekCollageBank(seed, cue) != null)

  useEffect(() => {
    void prefetchCollageAssets()
  }, [seed])

  useEffect(() => {
    let cancelled = false
    const activeCue = cue
    if (peekCollageBank(seed, activeCue)) {
      setBankReady(true)
      return
    }
    if (!startAlign) {
      setBankReady(false)
      return
    }
    void ensureCollageBank(seed, activeCue).then(() => {
      if (!cancelled) setBankReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [seed, startAlign, cueKey])

  return bankReady
}
