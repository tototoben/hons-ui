// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { pickFemaleVoice, speakText } from './photobashSpeech'

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

describe('speakText', () => {
  it('does not speak when the document is hidden', async () => {
    const speak = vi.fn()
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    await speakText('hello', { speak, cancel() {}, pause() {}, getVoices: () => [] } as unknown as SpeechSynthesis)
    expect(speak).not.toHaveBeenCalled()
  })
})
