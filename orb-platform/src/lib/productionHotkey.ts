export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
  )
}

function isTyping(): boolean {
  return typeof document !== 'undefined' && isTypingTarget(document.activeElement)
}

export function isProductionHotkey(
  event: Pick<KeyboardEvent, 'code' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'repeat'>,
): boolean {
  if (event.repeat) return false
  if (isTyping()) return false
  if (event.code !== 'KeyP' || !event.shiftKey) return false
  return event.metaKey || event.ctrlKey
}

export function isPickerDismissKey(
  event: Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'repeat'>,
): boolean {
  if (event.repeat) return false
  if (isTyping()) return false
  if (event.key === 'Escape') return true
  return isProductionHotkey(event)
}
