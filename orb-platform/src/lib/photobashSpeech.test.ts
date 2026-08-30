import { describe, expect, it } from 'vitest'
import { pickFemaleVoice } from './photobashSpeech'

function voice(name: string, lang = 'en-US'): SpeechSynthesisVoice {
  return { name, lang } as SpeechSynthesisVoice
}

describe('pickFemaleVoice', () => {
  it('prefers an explicitly female English voice over a male default', () => {
    expect(
      pickFemaleVoice([
        voice('Microsoft David - English (United States)'),
        voice('Microsoft Zira - English (United States)'),
        voice('Google UK English Female', 'en-GB'),
      ])?.name,
    ).toBe('Google UK English Female')
  })

  it('skips male-named voices when a known female name is present', () => {
    expect(
      pickFemaleVoice([voice('Alex'), voice('Samantha', 'en-US')])?.name,
    ).toBe('Samantha')
  })
})
