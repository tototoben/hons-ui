import { describe, expect, it } from 'vitest'
import { base } from '../config'
import wallLipClipsSource from './wallLipClips.ts?raw'
import {
  LIP_REST_FRAME,
  LIP_SPRITE_COLS,
  LIP_SPRITE_FRAME_COUNT,
  LIP_SPRITE_ROWS,
  LIP_SPRITE_SRC,
  lipFrameRect,
  lipStateAt,
} from './wallLipClips'

describe('wallLipClips', () => {
  it('maps every frame index to a rect inside the sprite sheet', () => {
    for (let i = 0; i < LIP_SPRITE_FRAME_COUNT; i += 1) {
      const rect = lipFrameRect(i)
      expect(rect.col).toBeGreaterThanOrEqual(0)
      expect(rect.col).toBeLessThan(LIP_SPRITE_COLS)
      expect(rect.row).toBeGreaterThanOrEqual(0)
      expect(rect.row).toBeLessThan(LIP_SPRITE_ROWS)
      expect(rect.u + rect.w).toBeLessThanOrEqual(1)
      expect(rect.v + rect.h).toBeLessThanOrEqual(1)
    }
  })

  it('produces the same state for the same elapsed time and seed', () => {
    const a = lipStateAt(5_000, 3)
    const b = lipStateAt(5_000, 3)
    expect(a).toEqual(b)
  })

  it('starts a burst (not resting) at time zero', () => {
    expect(lipStateAt(0, 3).resting).toBe(false)
  })

  it('never lands on the rest frame during a talking burst', () => {
    for (let t = 0; t < 20_000; t += 50) {
      const state = lipStateAt(t, 11)
      if (!state.resting) {
        expect(state.frame).not.toBe(LIP_REST_FRAME)
      }
    }
  })

  it('eventually pauses on the rest frame', () => {
    let sawRest = false
    for (let t = 0; t < 20_000; t += 50) {
      if (lipStateAt(t, 11).resting) {
        sawRest = true
        break
      }
    }
    expect(sawRest).toBe(true)
  })

  it('prefixes the lip sprite with the Vite base URL', () => {
    expect(wallLipClipsSource).toContain("LIP_SPRITE_SRC = base('/assets/wall-avatar/lips/mouth-sprite.jpg')")
    expect(LIP_SPRITE_SRC).toBe(base('/assets/wall-avatar/lips/mouth-sprite.jpg'))
    expect(LIP_SPRITE_SRC).toBe('/orb/assets/wall-avatar/lips/mouth-sprite.jpg')
  })
})
