import { describe, expect, it } from 'vitest'
import {
  alignFromCropEyes,
  coverCropRect,
  readEyeCenters,
  TARGET_LEFT_EYE,
  TARGET_RIGHT_EYE,
} from './faceBankAlign'
import { MATCH_LEFT_EYE, MATCH_RIGHT_EYE } from './wallMatchPhotobash'

describe('faceBankAlign', () => {
  it('targets the actual eye-shard centroids', () => {
    expect(TARGET_LEFT_EYE).toEqual(MATCH_LEFT_EYE)
    expect(TARGET_RIGHT_EYE).toEqual(MATCH_RIGHT_EYE)
    expect(TARGET_LEFT_EYE.x).toBeLessThan(TARGET_RIGHT_EYE.x)
    expect(TARGET_LEFT_EYE.x).toBeCloseTo(0.347, 2)
    expect(TARGET_RIGHT_EYE.x).toBeCloseTo(0.627, 2)
  })

  it('is a no-op when crop eyes already sit on the shard centers', () => {
    const align = alignFromCropEyes(
      { u: TARGET_LEFT_EYE.x, v: TARGET_LEFT_EYE.y },
      { u: TARGET_RIGHT_EYE.x, v: TARGET_RIGHT_EYE.y },
    )
    expect(align.scale).toBeCloseTo(1, 5)
    expect(align.offsetX).toBeCloseTo(0, 5)
    expect(align.offsetY).toBeCloseTo(0, 5)
  })

  it('scales up a too-narrow crop so the eyes land on the shards', () => {
    const align = alignFromCropEyes({ u: 0.4, v: 0.4 }, { u: 0.5, v: 0.4 })
    expect(align.scale).toBeGreaterThan(1)
  })

  it('prefers iris centers over outer-corner landmarks', () => {
    const landmarks = new Array(478)
    landmarks[33] = { x: 0.2, y: 0.4 }
    landmarks[133] = { x: 0.3, y: 0.4 }
    landmarks[263] = { x: 0.8, y: 0.4 }
    landmarks[362] = { x: 0.7, y: 0.4 }
    landmarks[468] = { x: 0.25, y: 0.41 }
    landmarks[473] = { x: 0.75, y: 0.41 }
    expect(readEyeCenters(landmarks)).toEqual([
      { x: 0.25, y: 0.41 },
      { x: 0.75, y: 0.41 },
    ])
  })

  it('falls back to inner/outer midpoints when irises are missing', () => {
    const landmarks = new Array(400)
    landmarks[33] = { x: 0.2, y: 0.4 }
    landmarks[133] = { x: 0.3, y: 0.5 }
    landmarks[263] = { x: 0.8, y: 0.4 }
    landmarks[362] = { x: 0.7, y: 0.5 }
    expect(readEyeCenters(landmarks)).toEqual([
      { x: 0.25, y: 0.45 },
      { x: 0.75, y: 0.45 },
    ])
  })

  it('matches coverDrawImage crop math for a tall source', () => {
    const crop = coverCropRect(100, 200, 0.9, 0.38)
    expect(crop.sw).toBe(100)
    expect(crop.sh).toBeCloseTo(100 / 0.9)
    expect(crop.sx).toBe(0)
    expect(crop.sy).toBeGreaterThan(0)
  })
})
