/** The kiosk scale runs 0–10, so 5 is exactly the middle (stored 0.5). */
export const SCALE_MIN = 0
export const SCALE_MAX = 10

function clampStep(step: number): number {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(step)))
}

/** Map a 0–10 kiosk step to the stored 0–1 scale value. */
export function valueFromScaleStep(step: number): number {
  return (clampStep(step) - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)
}

/** Map a stored 0–1 value back to the nearest 0–10 step. */
export function scaleStepFromValue(value: number): number {
  const clamped = Math.min(1, Math.max(0, value))
  return clampStep(SCALE_MIN + clamped * (SCALE_MAX - SCALE_MIN))
}

/** Parse a digit key (`0`–`9`) into a scale step, or null. 10 has no single
 * key; it is reached with the arrows or from the iPad. */
export function scaleStepFromKey(key: string): number | null {
  if (key.length === 1 && key >= '0' && key <= '9') return Number(key)
  return null
}
