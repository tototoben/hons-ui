// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyRemoteKey, resetRemoteSliderSeq } from './ipadSimLink'

describe('applyRemoteKey', () => {
  afterEach(() => {
    document.body.replaceChildren()
    resetRemoteSliderSeq()
  })

  it('types into a focused intake field the way React controlled inputs expect', () => {
    const input = document.createElement('input')
    input.className = 'journey-intake-field'
    const form = document.createElement('form')
    form.className = 'journey-intake'
    form.append(input)
    document.body.append(form)

    applyRemoteKey({ key: '3' })
    applyRemoteKey({ key: '4' })
    expect(input.value).toBe('34')
    expect(document.activeElement).toBe(input)

    applyRemoteKey({ special: 'backspace' })
    expect(input.value).toBe('3')
  })

  it('submits the surrounding form on return', () => {
    const form = document.createElement('form')
    form.className = 'journey-intake'
    const input = document.createElement('input')
    form.append(input)
    document.body.append(form)
    input.focus()

    let submitted = false
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      submitted = true
    })

    applyRemoteKey({ special: 'return' })
    expect(submitted).toBe(true)
  })

  it('drives a range input and clicks the scale confirm button', () => {
    const range = document.createElement('input')
    range.type = 'range'
    range.min = '0'
    range.max = '1'
    range.step = '0.01'
    range.value = '0.5'
    range.className = 'journey-scale-range'
    const wrap = document.createElement('div')
    wrap.className = 'journey-scale'
    wrap.append(range)

    const confirm = document.createElement('button')
    confirm.type = 'button'
    confirm.className = 'journey-height-confirm'
    wrap.append(confirm)
    document.body.append(wrap)

    let confirmed = false
    confirm.addEventListener('click', () => {
      confirmed = true
    })

    let sliderValue = 0.5
    window.addEventListener('hons-remote-slider', (event) => {
      sliderValue = Number((event as CustomEvent<{ value?: number }>).detail?.value)
    })

    applyRemoteKey({ slider: 0.73, seq: 1 })
    expect(sliderValue).toBeCloseTo(0.73)

    applyRemoteKey({ slider: 0.2, seq: 0 })
    expect(sliderValue).toBeCloseTo(0.73)

    applyRemoteKey({ special: 'confirm' })
    expect(confirmed).toBe(true)
  })

  it('dispatches Alt+Shift+P with a KeyP code and does not type into the intake field', () => {
    const input = document.createElement('input')
    input.className = 'journey-intake'
    document.body.append(input)
    input.focus()
    const onKey = vi.fn()
    window.addEventListener('keydown', onKey)

    applyRemoteKey({ key: 'p', alt: true, shift: true })

    expect(input.value).toBe('')
    expect(onKey).toHaveBeenCalled()
    const event = onKey.mock.calls[0][0] as KeyboardEvent
    expect(event.code).toBe('KeyP')
    expect(event.altKey).toBe(true)
    expect(event.shiftKey).toBe(true)
    window.removeEventListener('keydown', onKey)
  })

  it('maps a remote digit onto DigitN so the picker can lock a station', () => {
    const onKey = vi.fn()
    window.addEventListener('keydown', onKey)
    applyRemoteKey({ key: '2' })
    const event = onKey.mock.calls[0][0] as KeyboardEvent
    expect(event.key).toBe('2')
    expect(event.code).toBe('Digit2')
    window.removeEventListener('keydown', onKey)
  })
})
