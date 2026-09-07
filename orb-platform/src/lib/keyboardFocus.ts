import { publish } from './firehose'

/** Layout the iPad station remote should show for the current kiosk prompt. */
export type KeyboardFocusMode = 'text' | 'numeric' | 'yesno' | 'choice' | 'scale' | 'hidden'

export type KeyboardFocusLabels = {
  left: string
  right: string
  value?: number
}

export function keyboardFocusForQuestion(
  question: { type: string; numeric?: boolean } | undefined,
): KeyboardFocusMode {
  if (!question) return 'hidden'
  if (question.numeric) return 'numeric'
  if (question.type === 'yesno') return 'yesno'
  if (question.type === 'text') return 'text'
  if (question.type === 'scale') return 'scale'
  return 'hidden'
}

export function publishKeyboardFocus(
  station: string,
  mode: KeyboardFocusMode,
  labels?: KeyboardFocusLabels,
) {
  const data: { mode: KeyboardFocusMode; left?: string; right?: string; value?: number } = { mode }
  if (mode === 'yesno') {
    data.left = labels?.left ?? 'YES'
    data.right = labels?.right ?? 'NO'
  } else if ((mode === 'choice' || mode === 'scale') && labels) {
    data.left = labels.left
    data.right = labels.right
  }
  if (mode === 'scale' && typeof labels?.value === 'number' && Number.isFinite(labels.value)) {
    data.value = Math.min(1, Math.max(0, labels.value))
  }
  publish(station, 'keyboard_focus', data)
}
