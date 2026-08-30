// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import {
  getVisitorVoiceBlob,
  getVisitorVoiceTranscript,
  getVisitorVoiceUrl,
  resetVisitorVoiceCapture,
  setVisitorVoiceCapture,
  setVisitorVoiceTranscript,
} from './visitorVoiceCapture'

describe('visitorVoiceCapture', () => {
  afterEach(() => {
    resetVisitorVoiceCapture()
  })

  it('starts empty', () => {
    expect(getVisitorVoiceBlob()).toBeNull()
    expect(getVisitorVoiceUrl()).toBeNull()
    expect(getVisitorVoiceTranscript()).toBe('')
  })

  it('stores a blob and exposes an object URL', () => {
    const blob = new Blob(['hello'], { type: 'audio/webm' })
    setVisitorVoiceCapture(blob)
    expect(getVisitorVoiceBlob()).toBe(blob)
    expect(getVisitorVoiceUrl()).toMatch(/^blob:/)
  })

  it('clears on reset', () => {
    setVisitorVoiceCapture(new Blob(['hello'], { type: 'audio/webm' }))
    setVisitorVoiceTranscript('hello partner')
    resetVisitorVoiceCapture()
    expect(getVisitorVoiceBlob()).toBeNull()
    expect(getVisitorVoiceUrl()).toBeNull()
    expect(getVisitorVoiceTranscript()).toBe('')
  })
})
