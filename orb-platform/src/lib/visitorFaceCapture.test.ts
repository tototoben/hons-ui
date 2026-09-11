import { afterEach, describe, expect, it } from 'vitest'
import {
  captureVisitorFaceFrame,
  getVisitorFaceCapture,
  resetVisitorFaceCapture,
  setVisitorFaceCapture,
} from './visitorFaceCapture'

describe('visitorFaceCapture', () => {
  afterEach(() => {
    resetVisitorFaceCapture()
  })

  it('starts empty', () => {
    expect(getVisitorFaceCapture()).toBeNull()
  })

  it('stores and returns the latest capture', () => {
    setVisitorFaceCapture('data:image/jpeg;base64,abc')
    expect(getVisitorFaceCapture()).toBe('data:image/jpeg;base64,abc')
    setVisitorFaceCapture('data:image/jpeg;base64,def')
    expect(getVisitorFaceCapture()).toBe('data:image/jpeg;base64,def')
  })

  it('clears on reset', () => {
    setVisitorFaceCapture('data:image/jpeg;base64,abc')
    resetVisitorFaceCapture()
    expect(getVisitorFaceCapture()).toBeNull()
  })

  it('returns null if video has zero dimensions', () => {
    const video = { videoWidth: 0, videoHeight: 0 } as HTMLVideoElement
    expect(captureVisitorFaceFrame(video)).toBeNull()
  })
})
