export const SCALE_STEP_COUNT = 10

/** Map a 1–10 kiosk step to the stored 0–1 scale value. */
export function valueFromScaleStep(step: number): number {
  const clamped = Math.min(SCALE_STEP_COUNT, Math.max(1, Math.round(step)))
  return (clamped - 1) / (SCALE_STEP_COUNT - 1)
}

/** Map a stored 0–1 value back to the nearest 1–10 step. */
export function scaleStepFromValue(value: number): number {
  const clamped = Math.min(1, Math.max(0, value))
  return Math.min(SCALE_STEP_COUNT, Math.max(1, Math.round(clamped * (SCALE_STEP_COUNT - 1)) + 1))
}

/** Parse a digit key (`1`–`9`, `0` = 10) into a scale step, or null. */
export function scaleStepFromKey(key: string): number | null {
  if (key >= '1' && key <= '9') return Number(key)
  if (key === '0') return SCALE_STEP_COUNT
  return null
}

/** Key to send over KDE for a given scale step (`0` means step 10). */
export function scaleKeyForStep(step: number): string {
  const clamped = Math.min(SCALE_STEP_COUNT, Math.max(1, Math.round(step)))
  return clamped === SCALE_STEP_COUNT ? '0' : String(clamped)
}
