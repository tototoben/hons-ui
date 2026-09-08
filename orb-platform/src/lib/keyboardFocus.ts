import { publish } from './firehose'

/** Layout the iPad station remote should show for the current kiosk prompt.
 *  `numeric` is accepted from older kiosks; the iPad maps it to the letter
 *  keyboard (which now has a 1–0 row). New publishes use `text` for age too. */
export type KeyboardFocusMode = 'text' | 'numeric' | 'yesno' | 'choice' | 'scale' | 'hidden'

export type KeyboardFocusLabels = {
  left?: string
  right?: string
  value?: number
  prompt?: string
}

let focusSeq = 0

export function nextKeyboardFocusSeq() {
  focusSeq += 1
  return focusSeq
}

export function keyboardFocusForQuestion(
  question: { type: string; numeric?: boolean } | undefined,
): KeyboardFocusMode {
  if (!question) return 'hidden'
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
  const data: {
    mode: KeyboardFocusMode
    left?: string
    right?: string
    value?: number
    prompt?: string
    seq: number
  } = { mode, seq: nextKeyboardFocusSeq() }
  const prompt = labels?.prompt?.trim()
  if (prompt) data.prompt = prompt
  if (mode === 'yesno') {
    data.left = labels?.left ?? 'YES'
    data.right = labels?.right ?? 'NO'
  } else if ((mode === 'choice' || mode === 'scale') && labels) {
    if (labels.left) data.left = labels.left
    if (labels.right) data.right = labels.right
  }
  if (mode === 'scale' && typeof labels?.value === 'number' && Number.isFinite(labels.value)) {
    data.value = Math.min(1, Math.max(0, labels.value))
  }
  publish(station, 'keyboard_focus', data)
}
