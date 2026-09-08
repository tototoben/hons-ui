// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mirrorSettings } from '../dev/mirrorSettingsStore'
import { applyStationVibe } from '../lib/stationVibe'
import { resetVisitorFaceCapture } from '../lib/visitorFaceCapture'

vi.mock('./MirrorGuideOrb', () => ({
  MirrorGuideOrb: ({ className }: { className?: string }) => <div className={className} />,
}))

vi.mock('../lib/photobashTrigger', () => ({
  notifyRevealReady: vi.fn(() => 1),
}))

vi.mock('../lib/arsIngest', () => ({
  submitKioskInterview: vi.fn(),
}))

vi.mock('../hooks/useMicLevel', () => ({
  MIC_BAR_COUNT: 24,
  useMicLevel: () => Array.from({ length: 24 }, () => 0.2),
}))

import { ThirdStation } from './ThirdStation'

function settle() {
  return act(async () => {
    await Promise.resolve()
  })
}

async function enterRecording() {
  await act(async () => {
    vi.advanceTimersByTime(1000)
    await Promise.resolve()
  })
  await act(async () => {
    vi.advanceTimersByTime(1000 + 3 * 200)
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

  it('opens a mic viewfinder without camera or the top-left RECORDING label', async () => {
    act(() => root.render(<ThirdStation />))
    await settle()

    expect(container.textContent).toContain('STANDBY')
    expect(container.querySelector('.mirror-record-video')).toBeNull()
    expect(container.querySelector('.mirror-screen-recording')).toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
    })
    expect(container.querySelector('.mirror-status-label')).toBeNull()
    expect(container.textContent).not.toContain('LISTENING')

    await act(async () => {
      vi.advanceTimersByTime(1000 + 3 * 200)
      await Promise.resolve()
    })

    expect(container.querySelector('.mirror-status-label')).toBeNull()
    expect(container.querySelector('.mirror-rec-indicator')?.textContent).toContain('REC')
    expect(container.querySelector('.mirror-record-prompt')?.textContent).toBe('speak about yourself')
    expect(container.querySelector('.mirror-record-prompt .journey-headline-canvas')).not.toBeNull()
    expect(container.querySelector('.mirror-rec-haze')).not.toBeNull()
    expect(container.querySelector('.mirror-record-timer-haze')).not.toBeNull()
    expect(container.querySelectorAll('.mirror-record-level-bar')).toHaveLength(24)
    expect(container.querySelector('.mirror-record-video')).toBeNull()
  })

  it('cuts the countdown ring away as time elapses', async () => {
    act(() => root.render(<ThirdStation />))
    await settle()
    await enterRecording()

    const ring = container.querySelector<SVGPathElement>('.mirror-record-timer-progress')
    expect(ring?.getAttribute('d') ?? '').toMatch(/^M /)
    expect(container.querySelector('.mirror-record-timer-cut')).toBeNull()
    expect(container.querySelector('.mirror-record-timer .journey-headline-copy')?.textContent).toBe(
      '2',
    )
    const fullArc = ring?.getAttribute('d')

    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
    })

    const laterArc = container.querySelector('.mirror-record-timer-progress')?.getAttribute('d')
    expect(laterArc).not.toBe(fullArc)
    expect(laterArc ?? '').toMatch(/A 34 34 0 0 1/)
  })
})
