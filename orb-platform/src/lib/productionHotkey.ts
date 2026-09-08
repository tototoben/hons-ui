import type { DeviceLock } from './deviceLock'

export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
  )
}

function isTyping(): boolean {
  return typeof document !== 'undefined' && isTypingTarget(document.activeElement)
}

type OperatorChordEvent = Pick<
  KeyboardEvent,
  'code' | 'key' | 'shiftKey' | 'altKey' | 'metaKey' | 'ctrlKey' | 'repeat'
>

/** iPad station keyboard has Alt and Shift, not Ctrl. Mac keeps Cmd. */
function hasOperatorModifier(event: OperatorChordEvent): boolean {
  return event.altKey || event.metaKey
}

const OPERATOR_KEY_CHARS: Record<string, string> = {
  KeyP: 'p',
  KeyR: 'r',
  KeyT: 't',
}

function isOperatorChord(event: OperatorChordEvent, code: string): boolean {
  if (event.repeat) return false
  // KDE Connect on the Pis often drops Shift; Alt+letter (or Cmd on Mac) is enough.
  if (event.ctrlKey && !event.altKey && !event.metaKey) return false
  if (!hasOperatorModifier(event)) return false
  const expected = OPERATOR_KEY_CHARS[code]
  const codeMatch = event.code === code
  // KDE Connect virtual keys often arrive with `key` but no `code` in cog/WPE.
  const missingCode = !event.code || event.code === 'Unidentified'
  const keyMatch =
    missingCode &&
    expected !== undefined &&
    typeof event.key === 'string' &&
    event.key.length === 1 &&
    event.key.toLowerCase() === expected
  return codeMatch || keyMatch
}

export function isProductionHotkey(event: OperatorChordEvent): boolean {
  return isOperatorChord(event, 'KeyP')
}

export function isStationRestartHotkey(event: OperatorChordEvent): boolean {
  return isOperatorChord(event, 'KeyR')
}

export function isTranscriptHotkey(event: OperatorChordEvent): boolean {
  return isOperatorChord(event, 'KeyT')
}

export function isPickerDismissKey(
  event: Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey' | 'altKey' | 'metaKey' | 'ctrlKey' | 'repeat'>,
): boolean {
  if (event.repeat) return false
  if (event.key === 'Escape') return !isTyping()
  return isProductionHotkey(event)
}

const PICKER_DIGIT_LOCKS: Record<string, DeviceLock> = {
  '1': 'station-1',
  Digit1: 'station-1',
  Numpad1: 'station-1',
  '2': 'station-2',
  Digit2: 'station-2',
  Numpad2: 'station-2',
  '3': 'station-3',
  Digit3: 'station-3',
  Numpad3: 'station-3',
}

/** 1 / 2 / 3 lock Station I / II / III while the production picker is open. */
export function pickerLockFromKey(
  event: Pick<KeyboardEvent, 'key' | 'code' | 'repeat' | 'altKey' | 'metaKey' | 'ctrlKey'>,
): DeviceLock | null {
  if (event.repeat) return null
  if (event.altKey || event.metaKey || event.ctrlKey) return null
  return PICKER_DIGIT_LOCKS[event.key] ?? PICKER_DIGIT_LOCKS[event.code] ?? null
}
