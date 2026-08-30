// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isPickerDismissKey, isProductionHotkey, isTypingTarget } from './productionHotkey'

function chord(overrides: Partial<KeyboardEvent> = {}): Pick<
  KeyboardEvent,
  'code' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'repeat' | 'key'
> {
  return {
    code: 'KeyP',
    key: 'p',
    shiftKey: true,
    metaKey: true,
    ctrlKey: false,
    repeat: false,
    ...overrides,
  }
}

describe('productionHotkey', () => {
  beforeEach(() => {
    document.body.tabIndex = -1
    document.body.focus()
  })

  afterEach(() => {
    document.querySelectorAll('input, textarea').forEach((node) => node.remove())
  })

  it('treats input and textarea as typing targets', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true)
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true)
    expect(isTypingTarget(document.createElement('div'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })

  it('matches Cmd+Shift+P and Ctrl+Shift+P only', () => {
    expect(isProductionHotkey(chord())).toBe(true)
    expect(isProductionHotkey(chord({ metaKey: false, ctrlKey: true }))).toBe(true)
    expect(isProductionHotkey(chord({ metaKey: false, ctrlKey: false }))).toBe(false)
    expect(isProductionHotkey(chord({ shiftKey: false }))).toBe(false)
    expect(isProductionHotkey(chord({ code: 'KeyP', shiftKey: false, metaKey: true }))).toBe(false)
    expect(isProductionHotkey(chord({ metaKey: true, shiftKey: false }))).toBe(false)
    expect(isProductionHotkey(chord({ code: 'KeyO' }))).toBe(false)
  })

  it('ignores key repeat', () => {
    expect(isProductionHotkey(chord({ repeat: true }))).toBe(false)
    expect(isPickerDismissKey(chord({ key: 'Escape', repeat: true }))).toBe(false)
  })

  it('ignores the chord and Escape while an input or textarea is focused', () => {
    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    expect(isProductionHotkey(chord())).toBe(false)
    expect(isPickerDismissKey({ ...chord(), key: 'Escape' })).toBe(false)
    input.remove()

    const textarea = document.createElement('textarea')
    document.body.append(textarea)
    textarea.focus()
    expect(isProductionHotkey(chord({ metaKey: false, ctrlKey: true }))).toBe(false)
    textarea.remove()
  })

  it('treats Escape and the production chord as dismiss keys when not typing', () => {
    expect(isPickerDismissKey({ ...chord(), key: 'Escape', code: 'Escape', shiftKey: false, metaKey: false })).toBe(
      true,
    )
    expect(isPickerDismissKey(chord())).toBe(true)
    expect(isPickerDismissKey({ ...chord(), key: 'Enter', code: 'Enter', shiftKey: false, metaKey: false })).toBe(
      false,
    )
  })
})
