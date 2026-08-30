// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import {
  getVisitorVoiceBlob,
  getVisitorVoiceUrl,
  resetVisitorVoiceCapture,
  setVisitorVoiceCapture,
} from './visitorVoiceCapture'

describe('visitorVoiceCapture', () => {
  afterEach(() => {
    resetVisitorVoiceCapture()
  })

  it('starts empty', () => {
    expect(getVisitorVoiceBlob()).toBeNull()
    expect(getVisitorVoiceUrl()).toBeNull()
  })

  it('stores a blob and exposes an object URL', () => {
    const blob = new Blob(['hello'], { type: 'audio/webm' })
    setVisitorVoiceCapture(blob)
    expect(getVisitorVoiceBlob()).toBe(blob)
    expect(getVisitorVoiceUrl()).toMatch(/^blob:/)
  })

  it('clears on reset', () => {
    setVisitorVoiceCapture(new Blob(['hello'], { type: 'audio/webm' }))
    resetVisitorVoiceCapture()
    expect(getVisitorVoiceBlob()).toBeNull()
    expect(getVisitorVoiceUrl()).toBeNull()
  })
})
