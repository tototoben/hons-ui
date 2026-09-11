import { describe, expect, it } from 'vitest'
import { parseWallCaptureParams } from './wallCapture'

describe('wall capture params', () => {
  it('reads the seed and cue central puts in the capture URL', () => {
    const parsed = parseWallCaptureParams(
      '?view=1&wallRole=code&captureSeed=163717603&dialogue=0&captureCue=%7B%22ageBand%22%3A%22young%22%2C%22smile%22%3Atrue%7D',
    )
    expect(parsed?.seed).toBe(163717603)
    expect(parsed?.cue).toMatchObject({ ageBand: 'young', smile: true })
  })

  it('is off for the installation windows and bad seeds', () => {
    expect(parseWallCaptureParams('?view=1&wallRole=code')).toBeNull()
    expect(parseWallCaptureParams('?captureSeed=0')).toBeNull()
    expect(parseWallCaptureParams('?captureSeed=abc')).toBeNull()
    expect(parseWallCaptureParams('?captureSeed=5&captureCue=%7Bnot-json')?.cue).toEqual({})
  })
})
