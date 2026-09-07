import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseFaceBankManifest } from './faceBank'
import {
  collageCombinationStats,
  collageRects,
  collageRevealAt,
  drawWallCollage,
  mouthRectIndex,
  pickStrangerAssignments,
  pickTaggedStrangerAssignments,
  visitorRevealOrder,
} from './wallCollagePhotobash'

const manifestPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../public/assets/wall-avatar/face-bank/manifest.json',
)

describe('wallCollagePhotobash', () => {
  it('merges the three mouth-adjacent shards into one rect', () => {
    // 11 tuned zones, 3 merged into 1 mouth rect => 8 + 1 = 9.
    const rects = collageRects(1)
    expect(rects.length).toBe(9)
  })

  it('keeps collage pieces close to the shard boxes so features stay lined up', () => {
    const jittered = collageRects(1)
    const tight = collageRects(1, 0)
    expect(jittered).toHaveLength(tight.length)
    jittered.forEach((rect, index) => {
      expect(Math.abs(rect.x - tight[index].x)).toBeLessThan(0.02)
      expect(Math.abs(rect.y - tight[index].y)).toBeLessThan(0.02)
      expect(Math.abs(rect.w - tight[index].w)).toBeLessThan(0.02)
      expect(Math.abs(rect.h - tight[index].h)).toBeLessThan(0.02)
    })
  })

  it('produces the same rects for the same seed', () => {
    const a = collageRects(7)
    const b = collageRects(7)
    expect(a).toEqual(b)
  })

  it('always puts the mouth rect last', () => {
    const rects = collageRects(1)
    expect(mouthRectIndex(rects)).toBe(rects.length - 1)
  })

  it('keeps the merged mouth rect comparable in size to a single piece', () => {
    const rects = collageRects(1)
    const mouth = rects[mouthRectIndex(rects)]
    const others = rects.slice(0, -1)
    const avgOtherWidth = others.reduce((sum, r) => sum + r.w, 0) / others.length
    // Should be in the same ballpark as an average piece, not roughly double it
    // (the un-shrunk union of the three merged shards would be ~2x as wide).
    expect(mouth.w).toBeLessThan(avgOtherWidth * 1.8)
  })

  it('keeps every rect inside the plate bounds', () => {
    const rects = collageRects(1)
    rects.forEach((rect) => {
      expect(rect.x).toBeGreaterThanOrEqual(-0.1)
      expect(rect.y).toBeGreaterThanOrEqual(-0.1)
      expect(rect.x + rect.w).toBeLessThanOrEqual(1.1)
      expect(rect.y + rect.h).toBeLessThanOrEqual(1.1)
    })
  })

  it('assigns every rect a bank index when the pool is non-empty', () => {
    const assignments = pickStrangerAssignments(3, 10, 5)
    expect(assignments).toHaveLength(10)
    assignments.forEach((index) => {
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(5)
    })
  })

  it('falls back to -1 assignments when the bank is empty', () => {
    expect(pickStrangerAssignments(3, 4, 0)).toEqual([-1, -1, -1, -1])
  })

  it('picks matching bank faces for identity, age, and mouth smile', () => {
    const faces = parseFaceBankManifest({
      faces: [
        { file: 'w-young-smile.jpg', presentation: 'woman', ageBand: 'young', smile: true },
        { file: 'w-young.jpg', presentation: 'woman', ageBand: 'young', smile: false },
        { file: 'm-mid.jpg', presentation: 'man', ageBand: 'mid', smile: false },
      ],
    })
    const rects = collageRects(1)
    const mouth = mouthRectIndex(rects)
    const assignments = pickTaggedStrangerAssignments(
      9,
      faces,
      { presentation: 'woman', ageBand: 'young', smile: true },
      rects.length,
    )
    expect(assignments).toHaveLength(rects.length)
    assignments.forEach((index, slot) => {
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(faces.length)
      expect(faces[index].presentation).toBe('woman')
      if (slot === mouth) expect(faces[index].smile).toBe(true)
    })
    expect(pickTaggedStrangerAssignments(9, faces, { presentation: 'woman', ageBand: 'young', smile: true }, rects.length)).toEqual(
      assignments,
    )
  })

  it('counts how many 9-piece collages each answer type can seed from the live bank', () => {
    const faces = parseFaceBankManifest(JSON.parse(readFileSync(manifestPath, 'utf8')))
    const stats = collageCombinationStats(faces)
    expect(stats.faces).toBe(23)
    expect(stats.rectCount).toBe(9)
    expect(stats.typeCount).toBeGreaterThanOrEqual(8)
    expect(stats.maxCollages).toBeGreaterThan(stats.minCollages)
    expect(stats.maxCollages).toBeGreaterThan(1_000_000)
  })

  it('visits every rect exactly once in the reveal order', () => {
    const order = visitorRevealOrder(11, 9)
    expect(order).toHaveLength(9)
    expect(new Set(order).size).toBe(9)
  })

  it('reveals rects gradually across the reveal window', () => {
    const total = 9
    expect(collageRevealAt(0, 10_000, total)).toEqual({
      revealedCount: 0,
      nextOpacity: 0,
      progress: 0,
    })
    const mid = collageRevealAt(5_000, 10_000, total)
    expect(mid.progress).toBeCloseTo(0.5)
    expect(mid.revealedCount).toBeLessThan(total)
    const done = collageRevealAt(10_000, 10_000, total)
    expect(done.revealedCount).toBe(total)
    expect(done.nextOpacity).toBe(0)
  })

  it('does not draw bank photos until face aligns are ready', () => {
    const rects = collageRects(1)
    const image = { width: 64, height: 64 }
    let drawImageCalls = 0
    const ctx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      globalAlpha: 1,
      clearRect() {},
      save() {},
      restore() {},
      beginPath() {},
      rect() {},
      clip() {},
      drawImage() {
        drawImageCalls += 1
      },
      strokeRect() {},
    } as unknown as CanvasRenderingContext2D

    drawWallCollage(ctx, {
      width: 100,
      height: 100,
      rects,
      bankImages: [image],
      bankAligns: [],
      strangerAssignments: pickStrangerAssignments(1, rects.length, 1),
      visitorImage: null,
      revealedCells: new Set(),
    })

    expect(drawImageCalls).toBe(0)
  })

  it('draws bank photos once face aligns are ready', () => {
    const rects = collageRects(1)
    const image = { width: 64, height: 64 }
    const align = { scale: 1.2, offsetX: 0, offsetY: 0 }
    let drawImageCalls = 0
    const ctx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      globalAlpha: 1,
      clearRect() {},
      save() {},
      restore() {},
      beginPath() {},
      rect() {},
      clip() {},
      drawImage() {
        drawImageCalls += 1
      },
      strokeRect() {},
    } as unknown as CanvasRenderingContext2D

    drawWallCollage(ctx, {
      width: 100,
      height: 100,
      rects,
      bankImages: [image],
      bankAligns: [align],
      strangerAssignments: pickStrangerAssignments(1, rects.length, 1),
      visitorImage: null,
      revealedCells: new Set(),
    })

    expect(drawImageCalls).toBe(rects.length)
  })
})
