import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useStationVibe } from '../hooks/useStationVibe'
import {
  SCALE_MAX,
  SCALE_MIN,
  scaleStepFromKey,
  scaleStepFromValue,
  valueFromScaleStep,
} from '../lib/scaleTen'
import { REMOTE_SLIDER_EVENT } from '../lib/ipadSimLink'

/**
 * 0–10 slider (5 is the exact middle). The value is the shared 0–1 reading: the iPad sets it through
 * REMOTE_SLIDER_EVENT, and changes made on the kiosk itself (digit keys,
 * arrows, dragging the track) are reported through `onLocalChange` so the
 * caller can push them back to the iPad.
 */
export function MirrorScale({
  value,
  onChange,
  onLocalChange,
  leftLabel,
  rightLabel,
}: {
  value: number
  onChange: (value: number) => void
  onLocalChange?: (value: number) => void
  leftLabel: string
  rightLabel: string
}) {
  const [vibe] = useStationVibe()
  const warm = vibe === 'warm'
  const clamped = Math.min(1, Math.max(0, value))
  const step = scaleStepFromValue(clamped)
  const trackRef = useRef<HTMLDivElement>(null)

  const setLocalStep = (next: number) => {
    const nextValue = valueFromScaleStep(next)
    onChange(nextValue)
    onLocalChange?.(nextValue)
  }
  const setLocalStepRef = useRef(setLocalStep)
  setLocalStepRef.current = setLocalStep

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const keyStep = scaleStepFromKey(event.key)
      if (keyStep === null) return
      event.preventDefault()
      setLocalStepRef.current(keyStep)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const onSlider = (event: Event) => {
      const detail = (event as CustomEvent<{ value?: number }>).detail
      if (typeof detail?.value === 'number' && Number.isFinite(detail.value)) {
        onChange(Math.min(1, Math.max(0, detail.value)))
      }
    }
    window.addEventListener(REMOTE_SLIDER_EVENT, onSlider)
    return () => window.removeEventListener(REMOTE_SLIDER_EVENT, onSlider)
  }, [onChange])

  const stepFromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return step
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return scaleStepFromValue(ratio)
  }
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setLocalStep(stepFromPointer(event.clientX))
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) return
    const next = stepFromPointer(event.clientX)
    if (next !== step) setLocalStep(next)
  }

  const stepPercent = (n: number) => `${((n - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100}%`
  // The thumb sits on the step it reads out (the iPad only sends whole steps).
  const percent = stepPercent(step)

  return (
    <div className="journey-scale-slider">
      <div className="journey-scale-slider-labels">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div
        ref={trackRef}
        className="journey-scale-slider-track"
        role="slider"
        tabIndex={0}
        aria-label={`${leftLabel} to ${rightLabel}`}
        aria-valuemin={SCALE_MIN}
        aria-valuemax={SCALE_MAX}
        aria-valuenow={step}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={(event) => {
          const delta = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1
            : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1
              : 0
          if (!delta) return
          event.preventDefault()
          setLocalStep(Math.min(SCALE_MAX, Math.max(SCALE_MIN, step + delta)))
        }}
      >
        <div className="journey-scale-slider-rail" aria-hidden="true">
          <div className="journey-scale-slider-fill" style={{ width: percent }} />
        </div>
        <div className="journey-scale-slider-ticks" aria-hidden="true">
          {Array.from({ length: SCALE_MAX - SCALE_MIN + 1 }, (_, index) => {
            const tick = SCALE_MIN + index
            const classes = [
              tick <= step ? 'is-passed' : '',
              tick === (SCALE_MIN + SCALE_MAX) / 2 ? 'is-middle' : '',
            ].filter(Boolean)
            return (
              <span
                key={tick}
                className={classes.length ? classes.join(' ') : undefined}
                style={{ left: stepPercent(tick) }}
              />
            )
          })}
        </div>
        <div className="journey-scale-slider-thumb" style={{ left: percent }} aria-hidden="true">
          <span className="journey-scale-slider-readout">{step}</span>
        </div>
      </div>
      <div className="journey-scale-slider-numbers" aria-hidden="true">
        {[SCALE_MIN, (SCALE_MIN + SCALE_MAX) / 2, SCALE_MAX].map((n) => (
          <span key={n} style={{ left: stepPercent(n) }}>
            {n}
          </span>
        ))}
      </div>
      <p className="journey-scale-slider-hint">
        {warm ? 'Choose 0–10 on the tablet' : 'CHOOSE 0–10 ON THE TABLET'}
      </p>
    </div>
  )
}
