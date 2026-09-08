/**
 * Local-dev stand-in for KDE Connect: the Vite plugin at `/__hons/*`
 * carries keyboard_focus and remote keys between this kiosk page and
 * an iPad Simulator on the same Mac.
 */

export type RemoteKeyPayload = {
  key?: string
  special?: 'return' | 'backspace' | 'tab' | 'confirm'
  slider?: number
  seq?: number
  alt?: boolean
  shift?: boolean
  ctrl?: boolean
}

export const REMOTE_SLIDER_EVENT = 'hons-remote-slider'
export const REMOTE_CONFIRM_EVENT = 'hons-remote-confirm'

let lastSliderSeq = Number.NEGATIVE_INFINITY

export function resetRemoteSliderSeq() {
  lastSliderSeq = Number.NEGATIVE_INFINITY
}

function setNativeValue(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  const previous = field.value
  const tracker = (field as { _valueTracker?: { setValue: (next: string) => void } })._valueTracker
  tracker?.setValue(previous)
  setter?.call(field, value)
  field.dispatchEvent(new Event('input', { bubbles: true }))
  field.dispatchEvent(new Event('change', { bubbles: true }))
}

function rangeField() {
  return document.querySelector<HTMLInputElement>(
    '.journey-scale input[type="range"], .journey-height-control input[type="range"], input[type="range"]',
  )
}

function dispatchRemoteConfirm() {
  window.dispatchEvent(new CustomEvent(REMOTE_CONFIRM_EVENT))
}

/** Apply a remote slider position from MQTT (production kiosk path). */
export function applyRemoteSliderValue(value: number) {
  const clamped = Math.min(1, Math.max(0, value))
  window.dispatchEvent(new CustomEvent(REMOTE_SLIDER_EVENT, { detail: { value: clamped } }))
}

function applyRemoteSlider(value: number, seq?: number) {
  if (typeof seq === 'number' && Number.isFinite(seq)) {
    if (seq <= lastSliderSeq) return
    lastSliderSeq = seq
  }
  applyRemoteSliderValue(value)
}

function clickScaleConfirm() {
  const button = document.querySelector<HTMLButtonElement>('.journey-height-confirm')
  if (button) {
    button.click()
    return true
  }
  return false
}

function intakeTypingField() {
  return document.querySelector<HTMLInputElement>('.journey-intake input.journey-intake-field, .journey-intake input')
}

function typingField() {
  const active = document.activeElement
  if (active instanceof HTMLInputElement) {
    if (active.type === 'range' || active.type === 'button' || active.type === 'submit') return null
    return active
  }
  if (active instanceof HTMLTextAreaElement) {
    return active
  }
  return intakeTypingField()
}

/** Keep the hidden intake field focused so KDE Connect / remote keys land in React state. */
export function ensureIntakeTypingFocus() {
  const field = intakeTypingField()
  if (field && document.activeElement !== field) {
    field.focus({ preventScroll: true })
  }
  return field
}

function codeForKey(ch: string): string | undefined {
  if (ch.length === 1 && /[a-z]/i.test(ch)) return `Key${ch.toUpperCase()}`
  if (ch.length === 1 && /[0-9]/.test(ch)) return `Digit${ch}`
  if (ch === ' ') return 'Space'
  return undefined
}

export function applyRemoteKey(payload: RemoteKeyPayload) {
  if (typeof payload.slider === 'number' && Number.isFinite(payload.slider)) {
    applyRemoteSlider(payload.slider, payload.seq)
    return
  }
  ensureIntakeTypingFocus()
  if (payload.special === 'return' || payload.special === 'confirm') {
    const field = typingField()
    const form = field?.form ?? field?.closest('form')
    if (form instanceof HTMLFormElement) {
      form.requestSubmit()
      return
    }
    if (clickScaleConfirm()) return
    dispatchRemoteConfirm()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
    return
  }
  if (payload.special === 'backspace') {
    const field = typingField()
    if (field) {
      setNativeValue(field, field.value.slice(0, -1))
      return
    }
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }))
    return
  }
  if (payload.special === 'tab') {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    return
  }
  const ch = payload.key
  if (!ch) return
  const altKey = Boolean(payload.alt)
  const shiftKey = Boolean(payload.shift)
  const ctrlKey = Boolean(payload.ctrl)
  const operatorChord = altKey || ctrlKey
  const field = typingField()
  if (field && !operatorChord) {
    setNativeValue(field, field.value + ch)
  }
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: ch,
      code: codeForKey(ch),
      altKey,
      shiftKey,
      ctrlKey,
      bubbles: true,
      cancelable: true,
    }),
  )
}

function installScaleConfirmKeys() {
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return
    if (typingField()) return
    if (clickScaleConfirm()) return
    dispatchRemoteConfirm()
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}

export function connectIpadSimLink() {
  const unbindConfirm = installScaleConfirmKeys()
  if (!import.meta.env.DEV) return unbindConfirm
  const source = new EventSource('/__hons/remote-key/stream')
  source.onmessage = (event) => {
    try {
      applyRemoteKey(JSON.parse(event.data) as RemoteKeyPayload)
    } catch {
      // ignore a malformed frame
    }
  }
  return () => {
    source.close()
    unbindConfirm()
  }
}
