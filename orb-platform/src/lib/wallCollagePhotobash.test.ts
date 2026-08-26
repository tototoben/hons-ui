import { describe, expect, it } from 'vitest'
import {
  collageRects,
  collageRevealAt,
  mouthRectIndex,
  pickStrangerAssignments,
  visitorRevealOrder,
} from './wallCollagePhotobash'

describe('wallCollagePhotobash', () => {
  it('merges the three mouth-adjacent shards into one rect', () => {
    // 11 tuned zones, 3 merged into 1 mouth rect => 8 + 1 = 9.
    const rects = collageRects(1)
    expect(rects.length).toBe(9)
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
})
