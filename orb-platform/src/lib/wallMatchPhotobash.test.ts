import { describe, expect, it } from 'vitest'
import {
  getWallMatchShardCount,
  MATCH_FACE_SIZE,
  normalizeVisitorAlign,
  photobashRevealAt,
  PHOTOBASH_REVEAL_MS,
} from './wallMatchPhotobash'

describe('wallMatchPhotobash', () => {
  it('keeps a sparse set of visitor feature shards', () => {
    const count = getWallMatchShardCount()
    expect(count).toBeGreaterThanOrEqual(3)
    expect(count).toBeLessThanOrEqual(4)
  })

  it('keeps the match plate portrait-sized', () => {
    expect(MATCH_FACE_SIZE.width).toBe(864)
    expect(MATCH_FACE_SIZE.height).toBe(960)
  })

  it('reveals shards gradually instead of all at once', () => {
    expect(photobashRevealAt(0)).toEqual({
      shardCount: 0,
      nextShardOpacity: 0,
      progress: 0,
    })
    const mid = photobashRevealAt(PHOTOBASH_REVEAL_MS / 2)
    expect(mid.progress).toBeCloseTo(0.5)
    expect(mid.shardCount).toBeLessThan(getWallMatchShardCount())
    const done = photobashRevealAt(PHOTOBASH_REVEAL_MS)
    expect(done.shardCount).toBe(getWallMatchShardCount())
    expect(done.nextShardOpacity).toBe(0)
  })

  it('clamps visitor align values', () => {
    expect(normalizeVisitorAlign({ scale: 9, offsetX: 2, offsetY: -3 })).toEqual({
      scale: 2.5,
      offsetX: 0.45,
      offsetY: -0.45,
    })
  })
})
