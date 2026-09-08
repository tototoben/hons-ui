import { describe, expect, it } from 'vitest'
import {
  scaleKeyForStep,
  scaleStepFromKey,
  scaleStepFromValue,
  valueFromScaleStep,
} from './scaleTen'

describe('scaleTen', () => {
  it('maps steps to values across the 0–1 range', () => {
    expect(valueFromScaleStep(1)).toBe(0)
    expect(valueFromScaleStep(10)).toBe(1)
    expect(valueFromScaleStep(5)).toBeCloseTo(4 / 9)
  })

  it('round-trips values through the nearest step', () => {
    expect(scaleStepFromValue(valueFromScaleStep(3))).toBe(3)
    expect(scaleStepFromValue(0.5)).toBe(6)
  })

  it('parses digit keys with zero as ten', () => {
    expect(scaleStepFromKey('4')).toBe(4)
    expect(scaleStepFromKey('0')).toBe(10)
    expect(scaleStepFromKey('a')).toBeNull()
  })

  it('maps step ten to the zero key for KDE', () => {
    expect(scaleKeyForStep(10)).toBe('0')
    expect(scaleKeyForStep(4)).toBe('4')
  })
})
