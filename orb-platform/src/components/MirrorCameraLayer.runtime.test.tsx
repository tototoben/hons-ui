// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Appearance = {
  hair: { label: string; hex: string }
  eyes: { label: string; hex: string }
  morphometrics: Array<{ term: string; finding: string }>
}

const FULL_FACE = Array.from({ length: 455 }, () => ({ x: 0.5, y: 0.5, z: 0 }))

const camera = vi.hoisted(() => ({
  videoRef: { current: null as HTMLVideoElement | null },
  status: 'active' as const,
  landmarks: Array.from({ length: 455 }, () => ({ x: 0.5, y: 0.5, z: 0 })),
  signals: {
    blink: 0,
    gazeX: 0,
    gazeY: 0,
    mouthOpen: 0,
    smile: 0,
    browLift: 0,
    headYaw: 0,
    headPitch: 0,
    headRoll: 0,
  },
  appearance: null as null | Appearance,
  // Production hands the layer a ref it repaints from; a couple of the
  // station mocks still only expose the flat handle fields, which the
  // layer has to keep falling back to.
  sampleRef: null as null | {
    current: {
      landmarks: Array<{ x: number; y: number; z: number }>
      signals: Record<string, number>
      appearance: Appearance | null
    }
  },
}))

vi.mock('../hooks/useMirrorCamera', () => ({
  useMirrorCamera: () => camera,
}))

import { MirrorCameraLayer } from './MirrorCameraLayer'
import { applyStationVibe } from '../lib/stationVibe'

describe('MirrorCameraLayer', () => {
  let container: HTMLDivElement
  let animationFrames: FrameRequestCallback[]
  const fillText = vi.fn()
  const lineTo = vi.fn()
  const strokeOperations: Array<{
    strokeStyle: string
    lineWidth: number
    lineToCount: number
  }> = []
  const context = {
    scale: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo,
    closePath: vi.fn(),
    stroke: vi.fn(() => {
      strokeOperations.push({
        strokeStyle: context.strokeStyle,
        lineWidth: context.lineWidth,
        lineToCount: lineTo.mock.calls.length,
      })
    }),
    setLineDash: vi.fn(),
    ellipse: vi.fn(),
    fillText,
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    font: '',
  }

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    animationFrames = []
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      animationFrames.push(callback)
      return animationFrames.length
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    strokeOperations.length = 0
    camera.landmarks = FULL_FACE
    camera.appearance = null
    camera.sampleRef = null
    applyStationVibe('original')
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as WebGL2RenderingContext,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    container.remove()
  })

  it('draws eye tracking geometry without an eye vector text label', () => {
    const root = createRoot(container)
    act(() => root.render(<MirrorCameraLayer mode="eyes" />))

    expect(context.stroke).toHaveBeenCalled()
    expect(strokeOperations).toContainEqual({
      strokeStyle: 'rgba(185, 220, 235, 0.16)',
      lineWidth: 0.55,
      lineToCount: expect.any(Number),
    })
    expect(
      strokeOperations.find((operation) => operation.lineWidth === 0.55)?.lineToCount,
    ).toBeGreaterThan(40)
    expect(fillText).not.toHaveBeenCalledWith('EYE VECTOR', expect.anything(), expect.anything())
    expect(container.querySelector('.journey-appearance')).toBeNull()

    act(() => root.unmount())
  })

  it('prints sampled hair and eye colors with morphometric terms', () => {
    camera.appearance = {
      hair: { label: 'blonde', hex: '#d6bc76' },
      eyes: { label: 'green', hex: '#2e663a' },
      morphometrics: [
        { term: 'canthal tilt', finding: 'negative, −4.2°' },
        { term: 'facial index', finding: 'leptoprosopic, 148.1' },
      ],
    }
    const root = createRoot(container)
    act(() => root.render(<MirrorCameraLayer mode="face" />))

    const readout = container.querySelector('.journey-appearance')
    expect(readout?.textContent).toContain('Hair color')
    expect(readout?.textContent).toContain('blonde')
    expect(readout?.textContent).not.toContain('Skin tone')
    expect(readout?.textContent).toContain('green')
    expect(readout?.textContent).toContain('negative canthal tilt')
    expect(
      container.querySelector<HTMLElement>('[data-swatch="eyes"]')?.style.backgroundColor,
    ).toBe('rgb(46, 102, 58)')

    act(() => root.unmount())
  })

  it('paints strokes, pose properties and the readout from the sample ref', () => {
    // The handle fields are deliberately empty: detect ticks no longer
    // re-render, so everything on screen has to come off the ref.
    camera.landmarks = []
    camera.appearance = null
    camera.sampleRef = {
      current: {
        landmarks: FULL_FACE,
        signals: { ...camera.signals, headYaw: 0.5, headPitch: 0.25, headRoll: -0.5 },
        appearance: {
          hair: { label: 'auburn', hex: '#7a3b1f' },
          eyes: { label: 'hazel', hex: '#7d6135' },
          morphometrics: [],
        },
      },
    }
    const root = createRoot(container)
    act(() => root.render(<MirrorCameraLayer mode="face" />))

    expect(context.stroke).toHaveBeenCalled()
    const stage = container.querySelector<HTMLElement>('.journey-camera-stage')!
    expect(stage.style.getPropertyValue('--journey-pose-x')).toBe('4px')
    expect(stage.style.getPropertyValue('--journey-pose-y')).toBe('1.5px')
    expect(stage.style.getPropertyValue('--journey-pose-roll')).toBe('-0.9deg')
    expect(container.querySelector('.journey-appearance')?.textContent).toContain('auburn')

    act(() => root.unmount())
  })

  it('repaints pose and appearance when sampleRef identity changes on a later frame', () => {
    camera.landmarks = []
    camera.appearance = null
    const initialSample = {
      landmarks: FULL_FACE,
      signals: { ...camera.signals, headYaw: 0, headPitch: 0, headRoll: 0 },
      appearance: {
        hair: { label: 'blonde', hex: '#d6bc76' },
        eyes: { label: 'green', hex: '#2e663a' },
        morphometrics: [] as Array<{ term: string; finding: string }>,
      },
    }
    camera.sampleRef = { current: initialSample }
    const root = createRoot(container)
    act(() => root.render(<MirrorCameraLayer mode="face" />))

    const stage = container.querySelector<HTMLElement>('.journey-camera-stage')!
    expect(stage.style.getPropertyValue('--journey-pose-x')).toBe('0px')
    expect(container.querySelector('.journey-appearance')?.textContent).toContain('blonde')

    const strokeCountAfterMount = context.stroke.mock.calls.length

    camera.sampleRef.current = {
      landmarks: FULL_FACE,
      signals: { ...camera.signals, headYaw: 0.5, headPitch: 0.25, headRoll: -0.5 },
      appearance: {
        hair: { label: 'auburn', hex: '#7a3b1f' },
        eyes: { label: 'hazel', hex: '#7d6135' },
        morphometrics: [],
      },
    }

    act(() => {
      animationFrames.at(-1)?.(1000)
    })

    expect(stage.style.getPropertyValue('--journey-pose-x')).toBe('4px')
    expect(stage.style.getPropertyValue('--journey-pose-y')).toBe('1.5px')
    expect(container.querySelector('.journey-appearance')?.textContent).toContain('auburn')
    expect(context.stroke.mock.calls.length).toBeGreaterThan(strokeCountAfterMount)

    const strokeCountAfterUpdate = context.stroke.mock.calls.length

    act(() => {
      animationFrames.at(-1)?.(2000)
    })

    expect(context.stroke.mock.calls.length).toBe(strokeCountAfterUpdate)

    act(() => root.unmount())
  })

  it('still writes stage pose properties with the overlay off, without repainting', () => {
    camera.sampleRef = {
      current: {
        landmarks: [],
        signals: { ...camera.signals, headYaw: 0.5 },
        appearance: null,
      },
    }
    const root = createRoot(container)
    act(() => root.render(<MirrorCameraLayer mode="none" />))

    const stage = container.querySelector<HTMLElement>('.journey-camera-stage')!
    expect(stage.style.getPropertyValue('--journey-pose-x')).toBe('4px')
    expect(context.stroke).not.toHaveBeenCalled()
    expect(container.querySelector('.journey-appearance')).toBeNull()

    act(() => root.unmount())
  })
})
