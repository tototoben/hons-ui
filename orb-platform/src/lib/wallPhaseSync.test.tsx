// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePhotobashLoop, useWallSyncedPhase } from './wallPhaseSync'
import { notifyRevealReady, REVEAL_STORAGE_KEY } from './photobashTrigger'
import { resetLightingChannel } from './lightingCues'

const buses = new Map<string, Set<FakeBroadcastChannel>>()

class FakeBroadcastChannel {
  onmessage: ((event: MessageEvent) => void) | null = null

  constructor(public name: string) {
    if (!buses.has(name)) buses.set(name, new Set())
    buses.get(name)!.add(this)
  }

  postMessage(message: unknown) {
    for (const channel of buses.get(this.name) ?? []) {
      if (channel === this) continue
      channel.onmessage?.({ data: message } as MessageEvent)
    }
  }

  close() {
    buses.get(this.name)?.delete(this)
  }
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

function PhotobashProbe() {
  const state = usePhotobashLoop(true)
  return <output data-seed={state.photobashSeed} data-cycle={state.cycleKey} />
}

describe('useWallSyncedPhase conductor', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    buses.clear()
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
    resetLightingChannel()
    window.localStorage.removeItem(REVEAL_STORAGE_KEY)
    vi.unstubAllGlobals()
    vi.useRealTimers()
    buses.clear()
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

describe('usePhotobashLoop reveal handoff', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    buses.clear()
    window.localStorage.removeItem(REVEAL_STORAGE_KEY)
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
    resetLightingChannel()
    window.localStorage.removeItem(REVEAL_STORAGE_KEY)
    vi.unstubAllGlobals()
    buses.clear()
  })

  it('restarts the collage cycle when Station III signals reveal-ready', () => {
    act(() => root.render(<PhotobashProbe />))
    const before = Number(container.querySelector('output')?.dataset.cycle)

    act(() => {
      notifyRevealReady(99)
    })

    expect(Number(container.querySelector('output')?.dataset.cycle)).toBe(before + 1)
    expect(container.querySelector('output')?.dataset.seed).toBe('99')
  })
})
