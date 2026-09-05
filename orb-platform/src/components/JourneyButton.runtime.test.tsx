// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JourneyButton } from './JourneyButton'

describe('JourneyButton', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    container.remove()
  })

  it('keeps the label for assistive tech and paints a decorative haze canvas', () => {
    const root = createRoot(container)
    const onClick = vi.fn()
    act(() => {
      root.render(
        <JourneyButton type="button" onClick={onClick}>
          Continue
        </JourneyButton>,
      )
    })

    const button = container.querySelector('button')
    expect(button?.textContent).toBe('Continue')
    expect(button?.querySelector('.journey-action-copy')?.textContent).toBe('Continue')
    expect(button?.querySelector('.journey-action-haze canvas')).not.toBeNull()

    act(() => button?.click())
    expect(onClick).toHaveBeenCalledOnce()

    act(() => root.unmount())
  })
})
