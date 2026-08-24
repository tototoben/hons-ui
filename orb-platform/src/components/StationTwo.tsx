import { lazy, Suspense, useCallback, useEffect, useReducer, useState, type FormEvent } from 'react'
import {
  createStationTwoState,
  STATION_TWO_LIGHTNING,
  STATION_TWO_QUESTIONS,
  stationTwoReducer,
  type BinaryAnswer,
  type StationTwoPhase,
  type ThisOrThatPair,
} from '../lib/mirrorJourney'
import { getVisitorProfile } from '../lib/visitorProfile'
import { journeySettings } from '../dev/journeySettingsStore'
import { CompanionOutline } from './CompanionOutline'
import { DebraGuide } from './DebraGuide'
import { JourneyHeadline } from './JourneyHeadline'
import { MirrorChoice } from './MirrorChoice'
import { MirrorStationShell } from './MirrorStationShell'
import { useStationVibe } from '../hooks/useStationVibe'

const JourneyDevPanel = lazy(() =>
  import('../dev/JourneyDevPanel').then((m) => ({ default: m.JourneyDevPanel })),
)

const LIVE_POLL_MS = 150

/** Reads live so tuning the panel mid-phase takes effect next cycle
 * rather than needing a remount, same pattern as ThirdStation's timing. */
function getAutoPhaseDurationMs(phase: StationTwoPhase): number | undefined {
  if (phase === 'percentile') return journeySettings.timing.percentileMs
  if (phase === 'companion-intro') return journeySettings.timing.companionIntroMs
  if (phase === 'debra-brief') return journeySettings.timing.debraBriefMs
  if (phase === 'lightning-intro') return journeySettings.timing.lightningIntroMs
  return undefined
}

/** Bridges journeySettings.colors (plain object, no leva dependency, safe
 * for production) into the :root custom properties MirrorJourney.css
 * reads — set directly on documentElement (the actual :root), not
 * redeclared on any descendant, so there's no risk of the local-
 * declaration-shadows-ancestor bug that broke the Cards station once. */
function useLiveJourneyTheme() {
  useEffect(() => {
    let raf = 0
    let last = 0
    const tick = (now: number) => {
      if (now - last >= LIVE_POLL_MS) {
        last = now
        const root = document.documentElement.style
        root.setProperty('--mirror-ice', journeySettings.colors.ice)
        root.setProperty('--mirror-ink', journeySettings.colors.ink)
        root.setProperty('--mirror-quiet', journeySettings.colors.quiet)
        root.setProperty('--mirror-frost', journeySettings.colors.frost)
        root.setProperty('--journey-orb-size', `${journeySettings.orbSizePx}px`)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
}

const QUESTION_LINES_WARM = [
  ['Is attractiveness', 'important to you?'],
  ["Do you think you're", 'a smart person?'],
  ['Should your partner', 'be smart?'],
  ['How smart?'],
  ['Do you want a', 'traditional relationship?'],
  ['Have you ever watched', 'pornography?'],
  ['Have you knowingly', 'watched AI pornography?'],
  ['Do you have a', 'high libido?'],
  ['Have you ever thought', 'about cheating?'],
  ['Do you believe in', 'a higher power?'],
  ['God?'],
  ['Something else?'],
  ['Do you practice', 'escapism?'],
]
const QUESTION_LINES_ORIGINAL = QUESTION_LINES_WARM.map((lines) =>
  lines.map((line) => line.toUpperCase()),
)

function lightningLines(pair: ThisOrThatPair, warm: boolean): string[] {
  const lines = [`${pair.left} or`, `${pair.right.toLowerCase()}?`]
  return warm ? lines : lines.map((line) => line.toUpperCase())
}

export function StationTwo({ phaseDurationMs }: { phaseDurationMs?: number }) {
  const [vibe] = useStationVibe()
  const warm = vibe === 'warm'
  const [state, dispatch] = useReducer(stationTwoReducer, undefined, () => {
    const profile = getVisitorProfile()
    return createStationTwoState({
      age: profile.age,
      previousRelationships: profile.previousRelationships,
    })
  })
  useLiveJourneyTheme()

  useEffect(() => {
    const automaticDurationMs = getAutoPhaseDurationMs(state.phase)
    if (automaticDurationMs === undefined) return
    const timer = window.setTimeout(
      () => dispatch({ type: 'ADVANCE' }),
      phaseDurationMs ?? automaticDurationMs,
    )
    return () => window.clearTimeout(timer)
  }, [phaseDurationMs, state.phase])

  const answer = useCallback((value: BinaryAnswer) => dispatch({ type: 'ANSWER', value }), [])
  const submitText = useCallback((value: string) => dispatch({ type: 'SUBMIT_TEXT', value }), [])
  const debraPosition =
    state.phase === 'debra-brief' ? 'left' : state.phase === 'question' ? 'right' : 'upper'
  const question = STATION_TWO_QUESTIONS[state.questionIndex]
  const questionLines = (warm ? QUESTION_LINES_WARM : QUESTION_LINES_ORIGINAL)[state.questionIndex]
  const lightningPair = STATION_TWO_LIGHTNING[state.lightningIndex]

  return (
    <>
    {/* Also excluded in Vitest (MODE === 'test'): leva's stitches-based
        styling tries to insert a custom-property-only rule that jsdom's
        CSS parser can't handle, which would otherwise crash any test that
        fully mounts <StationTwo/>. Cards/Mirror have the same lazy-panel
        shape but happen to never be runtime-tested at their station-root
        level, so they've never hit this. */}
    {import.meta.env.DEV && import.meta.env.MODE !== 'test' ? (
      <Suspense fallback={null}>
        <JourneyDevPanel />
      </Suspense>
    ) : null}
    <MirrorStationShell
      station="II"
      cameraMode="none"
      statusLeft={
        <span className="journey-recording">
          <i /> {warm ? 'Listening' : 'RECORDING IN PROGRESS'}
        </span>
      }
    >
      {state.phase !== 'percentile' && state.phase !== 'complete' ? (
        <DebraGuide
          position={debraPosition}
          showIntroduction={state.phase === 'companion-intro' || state.phase === 'debra-brief'}
        />
      ) : null}

      {state.phase === 'percentile' ? (
        <div className="journey-message journey-message-bottom">
          <JourneyHeadline
            lines={
              warm
                ? ['You have been placed', 'in category Rho106.']
                : ['YOU HAVE BEEN PLACED', 'IN CATEGORY RHO106.']
            }
          >
            You have been placed in category Rho106.
          </JourneyHeadline>
        </div>
      ) : null}

      {state.phase === 'companion-intro' ? (
        <div className="journey-message journey-message-bottom">
          <JourneyHeadline
            lines={
              warm
                ? ['You will now be matched', 'with an AI partner.']
                : ['YOU WILL NOW BE MATCHED', 'WITH AN AI PARTNER.']
            }
          >
            You will now be matched with an AI partner.
          </JourneyHeadline>
        </div>
      ) : null}

      {state.phase === 'debra-brief' ? (
        <div className="journey-debra-copy">
          <JourneyHeadline
            lines={
              warm
                ? ['But first we need you to', 'answer a few questions...']
                : ['BUT FIRST WE NEED YOU TO', 'ANSWER A FEW QUESTIONS...']
            }
          >
            But first we need you to answer a few questions...
          </JourneyHeadline>
        </div>
      ) : null}

      {state.phase === 'question' && question?.type === 'yesno' ? (
        <div className="journey-question">
          <JourneyHeadline lines={questionLines}>{question.prompt}</JourneyHeadline>
          <MirrorChoice onAnswer={answer} />
        </div>
      ) : null}

      {state.phase === 'question' && question?.type === 'text' ? (
        <StationTwoTextQuestion prompt={question.prompt} lines={questionLines} onSubmit={submitText} />
      ) : null}

      {state.phase === 'question' && question?.type === 'scale' ? (
        <div className="journey-scale">
          <JourneyHeadline lines={questionLines}>{question.prompt}</JourneyHeadline>
          <label>
            <span>Not very</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={Number(state.answers[question.id] ?? 0.5)}
              onChange={(event) =>
                dispatch({ type: 'SET_SCALE', value: Number(event.target.value) })
              }
              aria-label={question.prompt}
            />
            <span>Extremely</span>
          </label>
          <button
            className="journey-height-confirm"
            type="button"
            onClick={() => dispatch({ type: 'ADVANCE' })}
          >
            {warm ? 'That feels right' : 'Confirm'}
          </button>
        </div>
      ) : null}

      {state.phase === 'height' ? (
        <div className="journey-height-phase">
          <CompanionOutline height={state.height} />
          <div className="journey-height-control">
            <JourneyHeadline
              lines={warm ? ['How tall is your', 'ideal partner?'] : ['HOW TALL IS YOUR', 'IDEAL PARTNER?']}
            >
              How tall is your ideal partner?
            </JourneyHeadline>
            <label>
              <span>Shorter</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={state.height}
                onChange={(event) =>
                  dispatch({ type: 'SET_HEIGHT', value: Number(event.target.value) })
                }
                aria-label="Ideal partner height"
              />
              <span>Taller</span>
            </label>
            <button
              className="journey-height-confirm"
              type="button"
              onClick={() => dispatch({ type: 'ADVANCE' })}
            >
              {warm ? 'That feels right' : 'Confirm height'}
            </button>
          </div>
        </div>
      ) : null}

      {state.phase === 'lightning-intro' ? (
        <div className="journey-message journey-message-bottom">
          <JourneyHeadline
            lines={
              warm
                ? ['Just a few quick', 'questions more...']
                : ['JUST A FEW QUICK', 'QUESTIONS MORE...']
            }
          >
            Just a few quick questions more...
          </JourneyHeadline>
        </div>
      ) : null}

      {state.phase === 'lightning' && lightningPair ? (
        <div className="journey-question">
          <JourneyHeadline lines={lightningLines(lightningPair, warm)}>
            {`${lightningPair.left} or ${lightningPair.right.toLowerCase()}?`}
          </JourneyHeadline>
          <MirrorChoice onAnswer={answer} labels={[lightningPair.left, lightningPair.right]} />
        </div>
      ) : null}

      {state.phase === 'complete' ? (
        <div className="journey-complete">
          <JourneyHeadline lines={warm ? ["When you're", 'ready'] : ['PROCEED TO THE', 'NEXT STATION']}>
            {warm ? "When you're ready" : 'Proceed to the next station'}
          </JourneyHeadline>
          <a href="#/mirror">Continue to Station III</a>
        </div>
      ) : null}
    </MirrorStationShell>
    </>
  )
}

function StationTwoTextQuestion({
  prompt,
  lines,
  onSubmit,
}: {
  prompt: string
  lines: string[]
  onSubmit: (value: string) => void
}) {
  const [draft, setDraft] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit(draft)
    setDraft('')
  }

  return (
    <form className="journey-intake" onSubmit={submit}>
      <label htmlFor="station-two-text-question">
        <JourneyHeadline as="span" lines={lines}>
          {prompt}
        </JourneyHeadline>
      </label>
      <input
        id="station-two-text-question"
        aria-label={prompt}
        autoFocus
        autoComplete="off"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button type="submit">Continue</button>
    </form>
  )
}
