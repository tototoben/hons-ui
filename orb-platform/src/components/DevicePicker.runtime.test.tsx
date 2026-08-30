// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DevicePicker } from './DevicePicker'

describe('DevicePicker', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('lists Photobash on full quality and omits it on kiosk', () => {
    const onLock = vi.fn()
    act(() => root.render(<DevicePicker quality="full" onLock={onLock} />))
    const labels = [...container.querySelectorAll('button')].map((button) => button.textContent)
    expect(labels).toEqual(['Station I', 'Station II', 'Station III', 'Photobash'])

    act(() => root.render(<DevicePicker quality="kiosk" onLock={onLock} />))
    const kioskLabels = [...container.querySelectorAll('button')].map((button) => button.textContent)
    expect(kioskLabels).toEqual(['Station I', 'Station II', 'Station III'])
  })

  it('emits station-1 when Station I is chosen', () => {
    const onLock = vi.fn()
    act(() => root.render(<DevicePicker quality="full" onLock={onLock} />))
    act(() => {
      container.querySelector('button')!.click()
    })
    expect(onLock).toHaveBeenCalledWith('station-1')
  })
})
