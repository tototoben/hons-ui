// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mirrorSettings } from '../dev/mirrorSettingsStore'
import { applyStationVibe } from '../lib/stationVibe'
import { getVisitorFaceCapture, resetVisitorFaceCapture } from '../lib/visitorFaceCapture'

const cameraMock = vi.hoisted(() => ({
  videoRef: { current: null as HTMLVideoElement | null },
  status: 'active' as const,
  sampleRef: { current: { landmarks: [], signals: null, appearance: null } },
  landmarks: [],
  signals: {
    blink: 0, gazeX: 0, gazeY: 0, mouthOpen: 0, smile: 0,
    browLift: 0, headYaw: 0, headPitch: 0, headRoll: 0,
  },
  appearance: null,
  devices: [],
  selectedDeviceId: null,
  activeDeviceId: null,
  selectDevice: () => undefined,
}))

vi.mock('../hooks/useMirrorCamera', () => ({
  useMirrorCamera: () => cameraMock,
}))

vi.mock('./MirrorGuideOrb', () => ({
  MirrorGuideOrb: ({ className }: { className?: string }) => <div className={className} />,
}))

vi.mock('../lib/photobashTrigger', () => ({
  notifyRevealReady: vi.fn(() => 1),
}))

import { ThirdStation } from './ThirdStation'

function settle() {
  return act(async () => {
    await Promise.resolve()
  })
}

describe('ThirdStation', () => {
  let container: HTMLDivElement
  let root: Root
  let timing: typeof mirrorSettings.timing

  beforeEach(() => {
    vi.useFakeTimers()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null)
    applyStationVibe('original')
    resetVisitorFaceCapture()
    timing = { ...mirrorSettings.timing }
    mirrorSettings.timing.introSeconds = 1
    mirrorSettings.timing.promptSeconds = 1
    mirrorSettings.timing.countdownStepSeconds = 0.2
    mirrorSettings.timing.recordingSeconds = 2
    mirrorSettings.timing.loadingSeconds = 1
  })

  afterEach(() => {
    act(() => root.unmount())
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    container.remove()
    resetVisitorFaceCapture()
    Object.assign(mirrorSettings.timing, timing)
  })

  it('warms the webcam on mount and fills the viewfinder when recording starts', async () => {
    act(() => root.render(<ThirdStation />))
    await settle()

    expect(container.textContent).toContain('STANDBY')
    const video = container.querySelector<HTMLVideoElement>('.mirror-record-video')
    expect(video).not.toBeNull()
    expect(container.querySelector('.mirror-screen-recording')?.classList.contains('is-live')).toBe(
      false,
    )

    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
    })
    expect(container.textContent).toContain('LISTENING')

    await act(async () => {
      vi.advanceTimersByTime(1000 + 3 * 200)
      await Promise.resolve()
    })

    expect(container.querySelector('.mirror-screen-recording')?.classList.contains('is-live')).toBe(
      true,
    )
    expect(container.querySelector('.mirror-rec-indicator')?.textContent).toContain('REC')
    expect(container.querySelector('.mirror-record-video')).toBe(video)
    expect(getVisitorFaceCapture()).toBeNull()
  })
})
