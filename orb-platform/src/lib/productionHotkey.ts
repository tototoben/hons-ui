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
  'code' | 'shiftKey' | 'altKey' | 'metaKey' | 'ctrlKey' | 'repeat'
>

/** iPad station keyboard has Alt and Shift, not Ctrl. Mac keeps Cmd. */
function hasOperatorModifier(event: OperatorChordEvent): boolean {
  return event.altKey || event.metaKey
}

function isOperatorChord(event: OperatorChordEvent, code: string): boolean {
  if (event.repeat) return false
  if (event.code !== code || !event.shiftKey) return false
  if (event.ctrlKey && !event.altKey && !event.metaKey) return false
  return hasOperatorModifier(event)
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

/** Finish Station III's spoken introduction before its timer expires. */
export function isFinishIntroHotkey(event: OperatorChordEvent): boolean {
  return isOperatorChord(event, 'KeyF')
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
