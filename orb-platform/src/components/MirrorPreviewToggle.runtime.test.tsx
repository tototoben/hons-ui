// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { MirrorPreviewFrame } from './MirrorPreviewToggle'

function typeWord(word: string) {
  for (const char of word) {
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: char })))
  }
}

describe('MirrorPreviewFrame', () => {
  afterEach(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: undefined })
  })

  it('has no visible toggle control', () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    act(() => root.render(<MirrorPreviewFrame><span>Station content</span></MirrorPreviewFrame>))

    expect(container.querySelector('button')).toBeNull()

    act(() => root.unmount())
  })

  it('switches to fill mode when "fills" is typed, and persists it', () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    const values = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })

    act(() => root.render(<MirrorPreviewFrame><span>Station content</span></MirrorPreviewFrame>))

    expect(container.firstElementChild?.className).toContain('experience-mirror-preview-portrait')
    typeWord('fills')
    expect(container.firstElementChild?.className).toContain('experience-mirror-preview-fill')
    expect(values.get('mirror-preview-mode')).toBe('fill')

    typeWord('fills')
    expect(container.firstElementChild?.className).toContain('experience-mirror-preview-portrait')

    act(() => root.unmount())
  })

  it('ignores the shortcut while a text field is focused', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    act(() =>
      root.render(
        <MirrorPreviewFrame>
          <input aria-label="answer" />
        </MirrorPreviewFrame>,
      ),
    )

    const input = container.querySelector('input')!
    input.focus()
    typeWord('fills')

    expect(container.firstElementChild?.className).toContain('experience-mirror-preview-portrait')

    act(() => root.unmount())
    container.remove()
  })
})
