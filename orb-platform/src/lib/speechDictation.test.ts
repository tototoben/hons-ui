import { describe, expect, it } from 'vitest'
import {
  dictationCaption,
  joinUtterance,
  normalizeTranscript,
  transcriptFromRecognitionResults,
} from './speechDictation'

describe('speechDictation', () => {
  it('joins final and interim pieces into one line', () => {
    expect(
      transcriptFromRecognitionResults([
        { isFinal: true, 0: { transcript: 'hello' } },
        { isFinal: false, 0: { transcript: 'there' } },
      ]),
    ).toBe('hello there')
  })

  it('collapses space and caps length', () => {
    expect(normalizeTranscript('  hello   partner  ')).toBe('hello partner')
    expect(joinUtterance('You', 'said hi')).toBe('You said hi')
    expect(normalizeTranscript('x'.repeat(800)).length).toBe(600)
  })

  it('keeps Listening until words arrive, then shows the spoken line', () => {
    expect(dictationCaption('', null, true)).toBe('Listening...')
    expect(dictationCaption('hello there', null, true)).toBe('hello there')
    expect(dictationCaption('', 'not-allowed', true)).toBe('Allow the microphone')
    expect(dictationCaption('', null, false)).toBe('Open this in Chrome to see your words')
  })
})
