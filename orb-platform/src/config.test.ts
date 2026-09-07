import { describe, expect, it } from 'vitest'
import { PARALLAX, base } from './config'

describe('PARALLAX asset URLs', () => {
  it('loads MediaPipe from the app origin, not a public CDN', () => {
    expect(PARALLAX.wasmBase).toBe(base('/mediapipe/wasm'))
    expect(PARALLAX.modelUrl).toBe(base('/mediapipe/face_landmarker.task'))
    expect(PARALLAX.wasmBase).not.toMatch(/jsdelivr|googleapis|https?:/)
    expect(PARALLAX.modelUrl).not.toMatch(/jsdelivr|googleapis|https?:/)
  })
})
