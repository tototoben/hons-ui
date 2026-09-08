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

export function isPickerDismissKey(
  event: Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey' | 'altKey' | 'metaKey' | 'ctrlKey' | 'repeat'>,
): boolean {
  if (event.repeat) return false
  if (event.key === 'Escape') return !isTyping()
  return isProductionHotkey(event)
}
