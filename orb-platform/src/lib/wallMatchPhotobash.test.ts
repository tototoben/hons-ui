import { describe, expect, it } from 'vitest'
import { getWallMatchShardCount, MATCH_FACE_SIZE } from './wallMatchPhotobash'

describe('wallMatchPhotobash', () => {
  it('defines multiple visitor puzzle shards', () => {
    expect(getWallMatchShardCount()).toBeGreaterThanOrEqual(5)
  })

  it('keeps the match plate portrait-sized', () => {
    expect(MATCH_FACE_SIZE.width).toBe(864)
    expect(MATCH_FACE_SIZE.height).toBe(960)
  })
})
