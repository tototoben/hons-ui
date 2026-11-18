// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyRemoteSliderValue } from '../lib/ipadSimLink'
import { MirrorScale } from './MirrorScale'

describe('MirrorScale', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(value: number, onChange = vi.fn(), onLocalChange = vi.fn()) {
    act(() =>
      root.render(
        <MirrorScale
          value={value}
          onChange={onChange}
          onLocalChange={onLocalChange}
          leftLabel="Not very"
          rightLabel="Extremely"
        />,
      ),
    )
    return { onChange, onLocalChange }
  }

  it('renders a 0–10 slider whose thumb sits at the shared value', () => {
    render(valueFromStep(7))
    const slider = container.querySelector('[role="slider"]')
    expect(slider?.getAttribute('aria-valuenow')).toBe('7')
    expect(slider?.getAttribute('aria-valuemin')).toBe('0')
    expect(slider?.getAttribute('aria-valuemax')).toBe('10')
    expect(container.querySelector('.journey-scale-slider-readout')?.textContent).toBe('7')
    const thumb = container.querySelector<HTMLElement>('.journey-scale-slider-thumb')
    expect(parseFloat(thumb?.style.left ?? '')).toBeCloseTo(70, 5)
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })

  it('follows the iPad without echoing the value back to it', () => {
    const { onChange, onLocalChange } = render(0.5)
    act(() => applyRemoteSliderValue(1))
    expect(onChange).toHaveBeenCalledWith(1)
    expect(onLocalChange).not.toHaveBeenCalled()
  })

  it('puts 5 exactly in the middle', () => {
    render(0.5)
    expect(container.querySelector('[role="slider"]')?.getAttribute('aria-valuenow')).toBe('5')
    expect(container.querySelector<HTMLElement>('.journey-scale-slider-thumb')?.style.left).toBe('50%')
    expect(container.querySelector<HTMLElement>('.is-middle')?.style.left).toBe('50%')
  })

  it('reports kiosk-side changes so the iPad can follow them', () => {
    const { onChange, onLocalChange } = render(0.5)
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '9' })))
    expect(onChange).toHaveBeenLastCalledWith(0.9)
    expect(onLocalChange).toHaveBeenLastCalledWith(0.9)

    const slider = container.querySelector<HTMLElement>('[role="slider"]')!
    act(() => slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })))
    // Value prop is still 0.5 (step 5), so one step left is 4.
    expect(onLocalChange).toHaveBeenLastCalledWith(valueFromStep(4))
  })
})

function valueFromStep(step: number) {
  return step / 10
}
