import { publish } from './firehose'

/** Layout the iPad station remote should show for the current kiosk prompt. */
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
  if (question.type === 'text') return question.numeric ? 'numeric' : 'text'
  if (question.type === 'scale') return 'scale'
  return 'hidden'
}

export function publishKeyboardFocus(
  station: string,
  mode: KeyboardFocusMode,
  labels?: KeyboardFocusLabels,
  options?: { includeValue?: boolean },
) {
  const includeValue = options?.includeValue ?? true
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
  if (
    includeValue &&
    mode === 'scale' &&
    typeof labels?.value === 'number' &&
    Number.isFinite(labels.value)
  ) {
    data.value = Math.min(1, Math.max(0, labels.value))
  }
  publish(station, 'keyboard_focus', data)
}

const KEYBOARD_FOCUS_HEARTBEAT_MS = 5000

/** Republish keyboard_focus on an interval so late iPad connects and MQTT reconnects
 *  always see the current prompt without waiting for a phase change. */
export function startKeyboardFocusHeartbeat(
  station: string,
  mode: KeyboardFocusMode,
  labels?: KeyboardFocusLabels,
  intervalMs = KEYBOARD_FOCUS_HEARTBEAT_MS,
  resolveLabels?: () => KeyboardFocusLabels | undefined,
): () => void {
  const snapshot = () => resolveLabels?.() ?? labels
  const tick = (includeValue: boolean) =>
    publishKeyboardFocus(station, mode, snapshot(), { includeValue })
  // First publish includes slider value (layout enter). Heartbeats omit value so
  // the iPad is not snapped back to a stale kiosk reading while dragging.
  tick(true)
  const timer = window.setInterval(() => tick(false), intervalMs)
  return () => window.clearInterval(timer)
}
