import { useEffect } from 'react'
import { useStationVibe } from '../hooks/useStationVibe'
import type { BinaryAnswer } from '../lib/mirrorJourney'

export function MirrorChoice({
  onAnswer,
  labels,
}: {
  onAnswer: (answer: BinaryAnswer) => void
  /** Overrides the Yes/No button text — used by Station II's "this or
   * that" lightning round, where the two options are literal words
   * rather than a real yes/no. Keyboard y/n still picks them in order. */
  labels?: [string, string]
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
      <button type="button" onClick={() => onAnswer('yes')}>
        {yesLabel}
      </button>
      <button type="button" onClick={() => onAnswer('no')}>
        {noLabel}
      </button>
      <p>{vibe === 'warm' ? 'or press Y / N' : 'Press Y or N'}</p>
    </div>
  )
}
