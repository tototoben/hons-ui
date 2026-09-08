import { useEffect } from 'react'
import { useStationVibe } from '../hooks/useStationVibe'
import {
  SCALE_STEP_COUNT,
  scaleStepFromKey,
  scaleStepFromValue,
  valueFromScaleStep,
} from '../lib/scaleTen'
import { REMOTE_SLIDER_EVENT } from '../lib/ipadSimLink'
import { JourneyButton } from './JourneyButton'

export function MirrorScale({
  value,
  onChange,
  leftLabel,
  rightLabel,
}: {
  value: number
  onChange: (value: number) => void
  leftLabel: string
  rightLabel: string
}) {
  const [vibe] = useStationVibe()
  const warm = vibe === 'warm'
  const selectedStep = scaleStepFromValue(value)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const step = scaleStepFromKey(event.key)
      if (step === null) return
      event.preventDefault()
      onChange(valueFromScaleStep(step))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onChange])

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

  return (
    <div className="journey-scale-ten" role="group" aria-label={`${leftLabel} to ${rightLabel}`}>
      <div className="journey-scale-ten-labels">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div className="journey-scale-ten-steps">
        {Array.from({ length: SCALE_STEP_COUNT }, (_, index) => {
          const step = index + 1
          const selected = step === selectedStep
          return (
            <JourneyButton
              key={step}
              type="button"
              className={`journey-scale-step${selected ? ' is-selected' : ''}`}
              aria-pressed={selected}
              onClick={() => onChange(valueFromScaleStep(step))}
            >
              {step}
            </JourneyButton>
          )
        })}
      </div>
      <p className="journey-scale-ten-hint">
        {warm ? 'Tap 1–10 or press the matching key' : 'PRESS 1–10'}
      </p>
    </div>
  )
}
