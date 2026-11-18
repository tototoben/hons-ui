import { describe, expect, it } from 'vitest'
import { scaleStepFromKey, scaleStepFromValue, valueFromScaleStep } from './scaleTen'

describe('scaleTen', () => {
  it('maps 0–10 steps across the 0–1 range with 5 in the exact middle', () => {
    expect(valueFromScaleStep(0)).toBe(0)
    expect(valueFromScaleStep(5)).toBe(0.5)
    expect(valueFromScaleStep(10)).toBe(1)
    expect(valueFromScaleStep(14)).toBe(1)
    expect(valueFromScaleStep(-3)).toBe(0)
  })

  it('round-trips values through the nearest step', () => {
    expect(scaleStepFromValue(valueFromScaleStep(3))).toBe(3)
    expect(scaleStepFromValue(0.5)).toBe(5)
    expect(scaleStepFromValue(0.84)).toBe(8)
  })

  it('parses digit keys 0–9 as their own step', () => {
    expect(scaleStepFromKey('0')).toBe(0)
    expect(scaleStepFromKey('4')).toBe(4)
    expect(scaleStepFromKey('a')).toBeNull()
    expect(scaleStepFromKey('10')).toBeNull()
  })
})
