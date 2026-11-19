// @vitest-environment jsdom

import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const vision = vi.hoisted(() => ({
  close: vi.fn(),
  detectForVideo: vi.fn<() => {
    faceLandmarks: Array<Array<{ x: number; y: number; z: number }>>
    faceBlendshapes?: Array<{
      categories: Array<{ categoryName: string; score: number }>
    }>
    facialTransformationMatrixes?: Array<{ data: number[] }>
  }>(() => ({ faceLandmarks: [] })),
  create: vi.fn(),
  resolve: vi.fn(),
}))

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vision.resolve },
  FaceLandmarker: { createFromOptions: vision.create },
}))

import { useMirrorCamera, type MirrorCameraHandle } from './useMirrorCamera'
import { stopSharedCameraStream } from '../lib/sharedCameraStream'
import {
  QUALITY_STORAGE_KEY,
  applyDeviceQuality,
  mirrorCameraConstraints,
  mirrorCameraFallbackConstraints,
} from '../lib/deviceQuality'

function Harness({
  onStatus,
  tracking = true,
  handleRef,
}: {
  onStatus: (status: string) => void
  tracking?: boolean
  // Detect ticks deliberately do not re-render, so per-frame signals can
  // only be read off the handle's sampleRef — not from rendered markup.
  handleRef?: { current: MirrorCameraHandle | null }
}) {
  const camera = useMirrorCamera({ tracking })
  if (handleRef) handleRef.current = camera
  useEffect(() => {
    onStatus(camera.status)
  }, [camera.status, onStatus])
  return <video ref={camera.videoRef} data-status={camera.status} />
}

describe('useMirrorCamera', () => {
  let container: HTMLDivElement
  let root: Root
  let animationFrames: FrameRequestCallback[]

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    animationFrames = []
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      animationFrames.push(callback)
      return animationFrames.length
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vision.resolve.mockResolvedValue({})
    vision.create.mockResolvedValue({
      close: vision.close,
      detectForVideo: vision.detectForVideo,
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    stopSharedCameraStream()
    vi.restoreAllMocks()
    vi.clearAllMocks()
    container.remove()
  })

  it('attaches a local camera stream and reports an active session', async () => {
    const stop = vi.fn()
    const stream = {
      getTracks: () => [{ stop }],
      getVideoTracks: () => [{}],
    } as unknown as MediaStream
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })
    const statuses: string[] = []

    await act(async () => {
      root.render(<Harness onStatus={(status) => statuses.push(status)} />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const video = container.querySelector('video')!
    expect(video.srcObject).toBe(stream)
    expect(statuses).toContain('active')
    expect(vision.create).toHaveBeenCalledOnce()
    expect(vision.create).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      }),
    )

    act(() => root.unmount())
    root = createRoot(container)
    // The stream outlives the scan so the next visitor's scan doesn't
    // trigger another permission prompt; MediaPipe is still torn down.
    expect(stop).not.toHaveBeenCalled()
    expect(vision.close).toHaveBeenCalledOnce()

    await act(async () => {
      root.render(<Harness onStatus={(status) => statuses.push(status)} />)
      for (let i = 0; i < 5; i += 1) await Promise.resolve()
    })
    expect(container.querySelector('video')!.srcObject).toBe(stream)
    expect(getUserMedia).toHaveBeenCalledOnce()

    act(() => root.unmount())
    root = createRoot(container)
    stopSharedCameraStream()
    expect(stop).toHaveBeenCalledOnce()
  })

  it('publishes blendshape and transformation signals from a detected face', async () => {
    const stream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    })
    vision.detectForVideo.mockReturnValue({
      faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
      faceBlendshapes: [{ categories: [
        { categoryName: 'eyeBlinkLeft', score: 0.8 },
        { categoryName: 'eyeBlinkRight', score: 0.4 },
        { categoryName: 'jawOpen', score: 0.75 },
      ] }],
      facialTransformationMatrixes: [{ data: [
        Math.cos(Math.PI / 6), 0, -Math.sin(Math.PI / 6), 0,
        0, 1, 0, 0,
        Math.sin(Math.PI / 6), 0, Math.cos(Math.PI / 6), 0,
        0, 0, 0, 1,
      ] }],
    })

    const handleRef: { current: MirrorCameraHandle | null } = { current: null }

    await act(async () => {
      root.render(<Harness handleRef={handleRef} onStatus={() => undefined} />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    const video = container.querySelector('video')!
    Object.defineProperty(video, 'readyState', {
      configurable: true,
      value: HTMLMediaElement.HAVE_CURRENT_DATA,
    })

    await act(async () => {
      animationFrames.at(-1)?.(1000)
    })

    const sample = handleRef.current!.sampleRef.current
    expect(sample.signals.blink).toBe(0.6000000000000001)
    expect(sample.signals.mouthOpen).toBe(0.75)
    expect(sample.signals.headYaw).toBeCloseTo(0.5)
  })

  it('gives MediaPipe a document canvas and survives a throwing detect tick', async () => {
    const stream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vision.detectForVideo
      .mockImplementationOnce(() => {
        throw new TypeError("undefined is not an object (evaluating 'GLctx.activeTexture')")
      })
      .mockReturnValue({ faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]] })
    const handleRef: { current: MirrorCameraHandle | null } = { current: null }

    await act(async () => {
      root.render(<Harness handleRef={handleRef} onStatus={() => undefined} />)
      for (let i = 0; i < 5; i += 1) await Promise.resolve()
    })
    // jsdom has no OffscreenCanvas, like WPE WebKit has no WebGL on one.
    expect(vision.create).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ canvas: expect.any(HTMLCanvasElement) }),
    )
    const video = container.querySelector('video')!
    Object.defineProperty(video, 'readyState', {
      configurable: true,
      value: HTMLMediaElement.HAVE_CURRENT_DATA,
    })

    await act(async () => {
      animationFrames.at(-1)?.(1000)
    })
    await act(async () => {
      animationFrames.at(-1)?.(2000)
    })

    expect(vision.detectForVideo).toHaveBeenCalledTimes(2)
    expect(handleRef.current!.sampleRef.current.landmarks).toHaveLength(1)
  })

  it('does not re-render on each MediaPipe detect tick', async () => {
    const stream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    })
    vision.detectForVideo.mockReturnValue({
      faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
    })
    let renders = 0
    function CountHarness() {
      renders += 1
      const camera = useMirrorCamera({ tracking: true })
      return <video ref={camera.videoRef} />
    }

    await act(async () => {
      root.render(<CountHarness />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    const video = container.querySelector('video')!
    Object.defineProperty(video, 'readyState', {
      configurable: true,
      value: HTMLMediaElement.HAVE_CURRENT_DATA,
    })
    const afterActive = renders

    await act(async () => {
      animationFrames.at(-1)?.(1000)
    })
    await act(async () => {
      animationFrames.at(-1)?.(2000)
    })

    expect(vision.detectForVideo).toHaveBeenCalled()
    expect(renders).toBe(afterActive)
  })

  it('relaxes the kiosk constraints for a camera without an MJPEG-only mode', async () => {
    applyDeviceQuality('kiosk')
    const stream = {
      getTracks: () => [{ stop: vi.fn() }],
      getVideoTracks: () => [{}],
    } as unknown as MediaStream
    const overconstrained = Object.assign(new Error('width'), { name: 'OverconstrainedError' })
    const getUserMedia = vi.fn()
      .mockRejectedValueOnce(overconstrained)
      .mockResolvedValueOnce(stream)
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })

    try {
      await act(async () => {
        root.render(<Harness onStatus={() => undefined} />)
        for (let i = 0; i < 8; i += 1) await Promise.resolve()
      })
    } finally {
      applyDeviceQuality('full')
      window.localStorage.removeItem(QUALITY_STORAGE_KEY)
    }

    expect(getUserMedia).toHaveBeenCalledTimes(2)
    expect(getUserMedia.mock.calls[0][0].video).toMatchObject(mirrorCameraConstraints('kiosk'))
    expect(getUserMedia.mock.calls[1][0].video).toMatchObject(
      mirrorCameraFallbackConstraints('kiosk'),
    )
    expect(container.querySelector('video')!.srcObject).toBe(stream)
  })

  it('keeps the journey usable when camera permission is denied', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')),
      },
    })
    const statuses: string[] = []

    await act(async () => {
      root.render(<Harness onStatus={(status) => statuses.push(status)} />)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(statuses.at(-1)).toBe('denied')
    expect(container.querySelector('video')?.dataset.status).toBe('denied')
  })

  it('falls back when a camera permission request remains unanswered', async () => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(() => new Promise<MediaStream>(() => undefined)) },
    })
    const statuses: string[] = []

    await act(async () => {
      root.render(<Harness onStatus={(status) => statuses.push(status)} />)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })

    expect(statuses.at(-1)).toBe('unavailable')
    expect(container.querySelector('video')?.dataset.status).toBe('unavailable')
    vi.useRealTimers()
  })

  it('keeps the live camera but skips MediaPipe when tracking is off', async () => {
    const stream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    })

    await act(async () => {
      root.render(<Harness tracking={false} onStatus={() => undefined} />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('video')?.srcObject).toBeUndefined()
    expect(container.querySelector('video')?.dataset.status).toBe('starting')
    expect(vision.create).not.toHaveBeenCalled()
  })
})
