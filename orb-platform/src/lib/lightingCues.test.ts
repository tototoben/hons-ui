import { describe, expect, it } from 'vitest'
import { lightingCueFor } from './lightingCues'

describe('lightingCueFor', () => {
  it('maps station phases to named lighting cues', () => {
    expect(lightingCueFor('station-1', 'phase:scan-face')).toBe('station-1-scan')
    expect(lightingCueFor('station-2', 'phase:question')).toBe('station-2-question')
    expect(lightingCueFor('station-2', 'phase:height')).toBe('station-2-height')
    expect(lightingCueFor('station-3', 'phase:recording')).toBe('station-3-recording')
    expect(lightingCueFor('station-3', 'reveal_ready')).toBe('photobash-reveal')
    expect(lightingCueFor('photobash', 'forming')).toBe('photobash-forming')
    expect(lightingCueFor('photobash', 'reveal')).toBe('photobash-reveal')
  })

  it('does not map lighting events back onto themselves', () => {
    expect(lightingCueFor('lighting', 'cue')).toBeNull()
    expect(lightingCueFor('station-2', 'unknown')).toBeNull()
  })
})
