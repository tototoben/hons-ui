// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useVisitorVoiceRecorder } from './useVisitorVoiceRecorder'
import { getVisitorVoiceTranscript, resetVisitorVoiceCapture } from '../lib/visitorVoiceCapture'

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

class FakeSpeechRecognition {
  continuous = false
  interimResults = false
  lang = ''
  maxAlternatives = 1
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null =
    null
  onerror: (() => void) | null = null
  onend: (() => void) | null = null

  start() {
    this.onresult?.({
      results: [{ isFinal: false, 0: { transcript: 'hello' } }],
    })
    this.onresult?.({
      results: [
        { isFinal: true, 0: { transcript: 'hello' } },
        { isFinal: false, 0: { transcript: 'partner' } },
      ],
    })
  }

  stop() {
    this.onend?.()
  }

  abort() {
    this.onend?.()
  }
}

function Probe({ active }: { active: boolean }) {
  const { caption } = useVisitorVoiceRecorder(active)
  return <p data-testid="live">{caption}</p>
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
    vi.stubGlobal('webkitSpeechRecognition', FakeSpeechRecognition)
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

  it('shows live dictation while recording', async () => {
    act(() => root.render(<Probe active />))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.querySelector('[data-testid="live"]')?.textContent).toBe('hello partner')
    act(() => root.render(<Probe active={false} />))
    await act(async () => {
      await Promise.resolve()
    })
    expect(getVisitorVoiceTranscript()).toBe('hello partner')
  })
})
