// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWallSyncedPhase } from './wallPhaseSync'

class FakeBroadcastChannel {
  onmessage: ((event: MessageEvent) => void) | null = null

  constructor(_name: string) {}

  postMessage(_message: unknown) {}

  close() {}
}

function ConductorProbe() {
  const state = useWallSyncedPhase(true)
  return (
    <output
      data-phase={state.phase}
      data-loading-progress={state.loadingProgress}
    />
  )
}

describe('useWallSyncedPhase conductor', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 16),
    )
    vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('resets local loading progress before the next intro render', () => {
    act(() => root.render(<ConductorProbe />))

    act(() => vi.advanceTimersByTime(3000))
    act(() => vi.advanceTimersByTime(3000))
    act(() => vi.advanceTimersByTime(800))
    act(() => vi.advanceTimersByTime(800))
    act(() => vi.advanceTimersByTime(800))
    act(() => vi.advanceTimersByTime(6000))
    expect(container.querySelector('output')?.dataset.phase).toBe('loading')

    act(() => vi.advanceTimersByTime(4000))
    expect(Number(container.querySelector('output')?.dataset.loadingProgress)).toBe(1)

    act(() => vi.advanceTimersByTime(61_000))
    expect(container.querySelector('output')?.dataset.phase).toBe('intro')
    expect(Number(container.querySelector('output')?.dataset.loadingProgress)).toBe(0)
  })
})
