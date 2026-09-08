// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  isPickerDismissKey,
  isProductionHotkey,
  isStationRestartHotkey,
  isTypingTarget,
} from './productionHotkey'

function chord(overrides: Partial<KeyboardEvent> = {}): Pick<
  KeyboardEvent,
  'code' | 'shiftKey' | 'altKey' | 'metaKey' | 'ctrlKey' | 'repeat' | 'key'
> {
  return {
    code: 'KeyP',
    key: 'p',
    shiftKey: true,
    altKey: true,
    metaKey: false,
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

  it('matches Alt+Shift+P and Cmd+Shift+P, not Ctrl+Shift+P', () => {
    expect(isProductionHotkey(chord())).toBe(true)
    expect(isProductionHotkey(chord({ altKey: false, metaKey: true }))).toBe(true)
    expect(isProductionHotkey(chord({ altKey: false, ctrlKey: true }))).toBe(false)
    expect(isProductionHotkey(chord({ altKey: false, metaKey: false }))).toBe(false)
    expect(isProductionHotkey(chord({ shiftKey: false }))).toBe(false)
    expect(isProductionHotkey(chord({ code: 'KeyP', shiftKey: false, metaKey: true }))).toBe(false)
    expect(isProductionHotkey(chord({ code: 'KeyO' }))).toBe(false)
  })

  it('matches Alt+Shift+R and Cmd+Shift+R as the station restart chord', () => {
    expect(isStationRestartHotkey(chord({ code: 'KeyR', key: 'r' }))).toBe(true)
    expect(isStationRestartHotkey(chord({ code: 'KeyR', key: 'r', altKey: false, metaKey: true }))).toBe(
      true,
    )
    expect(isStationRestartHotkey(chord({ code: 'KeyR', key: 'r', altKey: false, ctrlKey: true }))).toBe(
      false,
    )
    expect(isStationRestartHotkey(chord())).toBe(false)
  })

  it('ignores key repeat', () => {
    expect(isProductionHotkey(chord({ repeat: true }))).toBe(false)
    expect(isStationRestartHotkey(chord({ code: 'KeyR', key: 'r', repeat: true }))).toBe(false)
    expect(isPickerDismissKey(chord({ key: 'Escape', repeat: true }))).toBe(false)
  })

  it('still matches the picker chord while an input is focused', () => {
    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    expect(isProductionHotkey(chord())).toBe(true)
    expect(isPickerDismissKey({ ...chord(), key: 'Escape', code: 'Escape', shiftKey: false, altKey: false })).toBe(
      false,
    )
    input.remove()
  })

  it('treats Escape and the production chord as dismiss keys when not typing', () => {
    expect(
      isPickerDismissKey({
        ...chord(),
        key: 'Escape',
        code: 'Escape',
        shiftKey: false,
        altKey: false,
        metaKey: false,
      }),
    ).toBe(true)
    expect(isPickerDismissKey(chord())).toBe(true)
    expect(
      isPickerDismissKey({
        ...chord(),
        key: 'Enter',
        code: 'Enter',
        shiftKey: false,
        altKey: false,
        metaKey: false,
      }),
    ).toBe(false)
  })
})
