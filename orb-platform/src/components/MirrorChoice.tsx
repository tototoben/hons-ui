import { useEffect } from 'react'
import { useStationVibe } from '../hooks/useStationVibe'
import type { BinaryAnswer } from '../lib/mirrorJourney'
import { JourneyButton } from './JourneyButton'

export function MirrorChoice({
  onAnswer,
  labels,
  onScreenButtons = true,
}: {
  onAnswer: (answer: BinaryAnswer) => void
  /** Overrides the Yes/No button text — used by Station II's "this or
   * that" lightning round, where the two options are literal words
   * rather than a real yes/no. Keyboard y/n still picks them in order. */
  labels?: [string, string]
  /** false when the iPad is the only input: the kiosk shows just the hint,
   * and answers arrive as the same y/n key events the remote sends. */
  onScreenButtons?: boolean
}) {
  const [vibe] = useStationVibe()
  const [yesLabel, noLabel] = labels ?? ['Yes', 'No']
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const key = event.key.toLowerCase()
      if (key !== 'y' && key !== 'n') return
      // Without this, the browser's default keypress action fires after
      // our answer handler has already advanced the phase — if the next
      // question is a text field that autofocuses, the same 'y'/'n'
      // character gets typed straight into it.
      event.preventDefault()
      onAnswer(key === 'y' ? 'yes' : 'no')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onAnswer])

  return (
    <div
      className="journey-choice"
      role="group"
      aria-label={labels ? `Choose ${yesLabel} or ${noLabel}` : 'Answer yes or no'}
    >
      {onScreenButtons ? (
        <>
          <JourneyButton type="button" onClick={() => onAnswer('yes')}>
            {yesLabel}
          </JourneyButton>
          <JourneyButton type="button" onClick={() => onAnswer('no')}>
            {noLabel}
          </JourneyButton>
        </>
      ) : null}
      <p>
        {labels
          ? vibe === 'warm'
            ? `Tap ${yesLabel} or ${noLabel}`
            : `CHOOSE ${yesLabel.toUpperCase()} OR ${noLabel.toUpperCase()}`
          : vibe === 'warm'
            ? 'or press YES / NO'
            : 'Press YES or NO'}
      </p>
    </div>
  )
}
