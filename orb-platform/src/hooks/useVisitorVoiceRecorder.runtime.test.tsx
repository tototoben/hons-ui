// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useVisitorVoiceRecorder } from './useVisitorVoiceRecorder'
import { getVisitorVoiceBlob, resetVisitorVoiceCapture } from '../lib/visitorVoiceCapture'

class FakeMediaRecorder {
  state = 'inactive'
  mimeType = 'audio/webm'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['clip'], { type: 'audio/webm' }) })
    this.onstop?.()
  }
}

function Probe({ active }: { active: boolean }) {
  useVisitorVoiceRecorder(active)
  return null
}

describe('useVisitorVoiceRecorder', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    resetVisitorVoiceCapture()
    vi.unstubAllGlobals()
  })

  it('stores a clip when recording stops', async () => {
    act(() => root.render(<Probe active />))
    await act(async () => {
      await Promise.resolve()
    })
    act(() => root.render(<Probe active={false} />))
    await act(async () => {
      await Promise.resolve()
    })
    expect(getVisitorVoiceBlob()).not.toBeNull()
  })
})
