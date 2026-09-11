// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureVisitorFaceFrame,
  getVisitorFaceCapture,
  resetVisitorFaceCapture,
  setVisitorFaceCapture,
} from './visitorFaceCapture'

function fillLuminance(size: number, value: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(size * size * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
    data[i + 3] = 255
  }
  return data
}

/** Same context stub shape for every canvas the module creates: the
 * capture canvas (save/translate/scale/drawImage/restore) and the 16x16
 * luminance probe canvas (drawImage/getImageData). */
function mockCanvasContext(probeData: Uint8ClampedArray) {
  return {
    save: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    restore: vi.fn(),
    getImageData: vi.fn(() => ({ data: probeData })),
  }
}

describe('visitorFaceCapture', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })))
  })

  afterEach(() => {
    resetVisitorFaceCapture()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
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

  it('rejects a near-black frame instead of storing it', () => {
    // 2026-09-11: two visitors got a solid-black frame locked in as their
    // photo for the rest of the visit -- the immediate-capture path took
    // whatever frame had dimensions, black or not.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCanvasContext(fillLuminance(16, 2)) as unknown as CanvasRenderingContext2D,
    )
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement

    expect(captureVisitorFaceFrame(video)).toBeNull()
    expect(toDataURL).not.toHaveBeenCalled() // rejected before the expensive encode
  })

  it('accepts a normally-lit frame', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCanvasContext(fillLuminance(16, 140)) as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,lit-frame',
    )
    const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement

    expect(captureVisitorFaceFrame(video)).toBe('data:image/jpeg;base64,lit-frame')
  })

  it('posts a diagnostic summary without the image data itself', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCanvasContext(fillLuminance(16, 140)) as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,lit-frame-contents',
    )
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement

    captureVisitorFaceFrame(video, [{ x: 0.5, y: 0.5 }])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:8087/api/diagnostics/wall')
    const body = JSON.parse(init.body as string)
    expect(body).toMatchObject({
      kind: 'face_capture',
      accepted: true,
      landmark_count: 1,
      width: 864,
      height: 960,
    })
    expect(JSON.stringify(body)).not.toContain('lit-frame-contents')
  })
})
