import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VISITOR_ALIGN,
  getWallMatchShardPoolCount,
  MATCH_FACE_SIZE,
  normalizeVisitorAlign,
  photobashRevealAt,
  PHOTOBASH_REVEAL_MS,
  pickRevealShards,
  SHARDS_PER_REVEAL,
} from './wallMatchPhotobash'

describe('wallMatchPhotobash', () => {
  it('keeps a larger pool of visitor feature shards', () => {
    expect(getWallMatchShardPoolCount()).toBeGreaterThanOrEqual(8)
  })

  it('uses the tuned visitor lineup as default', () => {
    expect(DEFAULT_VISITOR_ALIGN.scale).toBeCloseTo(1.62)
    expect(DEFAULT_VISITOR_ALIGN.offsetY).toBeCloseTo(-0.17378)
  })

  it('keeps the match plate portrait-sized', () => {
    expect(MATCH_FACE_SIZE.width).toBe(864)
    expect(MATCH_FACE_SIZE.height).toBe(960)
  })

  it('picks a seeded random subset each reveal', () => {
    const a = pickRevealShards(42)
    const b = pickRevealShards(42)
    const c = pickRevealShards(99)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThanOrEqual(SHARDS_PER_REVEAL.min)
    expect(a.length).toBeLessThanOrEqual(SHARDS_PER_REVEAL.max)
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(c))
  })

  it('reveals shards gradually instead of all at once', () => {
    const total = 5
    expect(photobashRevealAt(0, PHOTOBASH_REVEAL_MS, total)).toEqual({
      shardCount: 0,
      nextShardOpacity: 0,
      progress: 0,
    })
    const mid = photobashRevealAt(PHOTOBASH_REVEAL_MS / 2, PHOTOBASH_REVEAL_MS, total)
    expect(mid.progress).toBeCloseTo(0.5)
    expect(mid.shardCount).toBeLessThan(total)
    const done = photobashRevealAt(PHOTOBASH_REVEAL_MS, PHOTOBASH_REVEAL_MS, total)
    expect(done.shardCount).toBe(total)
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
