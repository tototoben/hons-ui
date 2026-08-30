// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeviceUnlockLayer } from './DeviceUnlockLayer'

describe('DeviceUnlockLayer', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    vi.clearAllTimers()
    vi.useRealTimers()
    container.remove()
  })

  it('unlocks after a two-second corner hold, not before', () => {
    const onUnlock = vi.fn()
    act(() => root.render(<DeviceUnlockLayer onUnlock={onUnlock} />))
    const corner = container.querySelector('[data-unlock-corner]')!
    act(() => {
      corner.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    act(() => {
      vi.advanceTimersByTime(1999)
    })
    expect(onUnlock).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onUnlock).toHaveBeenCalledTimes(1)
  })

  it('unlocks on tilde unless a text field is focused', () => {
    const onUnlock = vi.fn()
    act(() => root.render(<DeviceUnlockLayer onUnlock={onUnlock} />))
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '~', bubbles: true }))
    })
    expect(onUnlock).toHaveBeenCalledTimes(1)

    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '~', bubbles: true }))
    })
    expect(onUnlock).toHaveBeenCalledTimes(1)
    input.remove()
  })
})
