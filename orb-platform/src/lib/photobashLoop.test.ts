import { describe, expect, it } from 'vitest'
import { WALL_TIMING } from './wallPhaseSync'
import {
  PHOTOBASH_CYCLE_MS,
  PHOTOBASH_FILL_MS,
  mintPhotobashSeed,
  photobashProgress,
} from './photobashLoop'

describe('photobashLoop', () => {
  it('uses the wall loading duration as the cycle', () => {
    expect(PHOTOBASH_CYCLE_MS).toBe(WALL_TIMING.loadingSeconds * 1000)
    expect(PHOTOBASH_FILL_MS).toBe(4000)
  })

  it('mints a non-negative integer seed from the random source', () => {
    expect(mintPhotobashSeed(() => 0.42)).toBe((0.42 * 1_000_000_000) | 0)
  })

  it('fills progress over four seconds then holds at 1', () => {
    expect(photobashProgress(0)).toBe(0)
    expect(photobashProgress(2000)).toBe(0.5)
    expect(photobashProgress(4000)).toBe(1)
    expect(photobashProgress(20000)).toBe(1)
  })
})
