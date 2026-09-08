import { lazy, Suspense, useCallback, useEffect, useReducer, useRef, useState, type FormEvent } from 'react'
import {
  createStationTwoState,
  STATION_TWO_LIGHTNING,
  STATION_TWO_QUESTIONS,
  stationTwoReducer,
  type BinaryAnswer,
  type StationTwoAction,
  type StationTwoPhase,
  type StationTwoState,
  type ThisOrThatPair,
} from '../lib/mirrorJourney'
import { firehoseReducer, publish } from '../lib/firehose'
import { loadStationTwoState, saveStationTwoState } from '../lib/interviewStore'
import { useVisitCentralPoll } from '../hooks/useVisitCentral'
import {
  isStationTurnActive,
  peekStationOneForStation,
  shouldGateStationTurn,
  visitSessionKeyForStation,
} from '../lib/visitCentral'
import { deriveStationStatus } from '../lib/stationStatus'
import { getVisitorProfile, visitorProfileFromAnswers } from '../lib/visitorProfile'
import { journeySettings } from '../dev/journeySettingsStore'
import { CompanionOutline } from './CompanionOutline'
import { DebraGuide } from './DebraGuide'
import { JourneyButton } from './JourneyButton'
import { JourneyHeadline } from './JourneyHeadline'
import { MirrorChoice } from './MirrorChoice'
import { MirrorScale } from './MirrorScale'
import { MirrorStationShell } from './MirrorStationShell'
import { useStationVibe } from '../hooks/useStationVibe'
import { readDeviceLock } from '../lib/deviceLock'
import { keyboardFocusForQuestion, startKeyboardFocusHeartbeat } from '../lib/keyboardFocus'
import { scaleStepFromValue, valueFromScaleStep } from '../lib/scaleTen'
import { showTuningPanel } from '../lib/tune'
import { StationTurnWait } from './StationTurnWait'

const JourneyDevPanel = lazy(() =>
  import('../dev/JourneyDevPanel').then((m) => ({ default: m.JourneyDevPanel })),
)

const HOW_SMART_SCALE = { left: 'Not very', right: 'Extremely' }
const HEIGHT_SCALE = { left: 'Shorter', right: 'Taller' }

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

const STATION_ID = 'station-2'

function actionToEvent(action: StationTwoAction): { event: string; data?: unknown } | null {
  switch (action.type) {
    case 'SUBMIT_TEXT':
      return { event: 'text_submitted', data: { value: action.value.trim() } }
    case 'ANSWER':
      return { event: 'desire_answer', data: { answer: action.value } }
    case 'ADVANCE':
      return { event: 'phase_advance' }
    case 'SET_SCALE':
    case 'SET_HEIGHT':
      return null
    default:
      return null
  }
}

function phaseEvent(phase: StationTwoState['phase']): string {
  return `phase:${phase}`
}

function initialStationTwoState(): StationTwoState {
  const centralMode = shouldGateStationTurn(2)
  const centralOne = peekStationOneForStation(2)
  if (centralOne?.answers) {
    const profile = visitorProfileFromAnswers(centralOne.answers)
    return createStationTwoState({
      age: profile.age,
      previousRelationships: profile.previousRelationships,
    })
  }
  // Never fall back to stale localStorage on a Central-backed kiosk. The
  // current visit's Station I answers must arrive before the question flow
  // starts, otherwise adult-gated questions can be skipped on first mount.
  if (centralMode) return createStationTwoState()
  const profile = getVisitorProfile()
  const saved = loadStationTwoState()
  if (saved) {
    return {
      ...saved,
      age: profile.age ?? saved.age,
      previousRelationships: profile.previousRelationships ?? saved.previousRelationships,
    }
  }
  return createStationTwoState({
    age: profile.age,
    previousRelationships: profile.previousRelationships,
  })
}

function lightningLines(pair: ThisOrThatPair, warm: boolean): string[] {
  const lines = [`${pair.left} or`, `${pair.right.toLowerCase()}?`]
  return warm ? lines : lines.map((line) => line.toUpperCase())
}

export function StationTwo({ phaseDurationMs }: { phaseDurationMs?: number }) {
  const visits = useVisitCentralPoll()
  if (!isStationTurnActive(2, visits)) {
    const status = deriveStationStatus(2, visits)
    return <StationTurnWait station="II" stationId="station-2" detail={status.detail} />
  }
  return (
    <StationTwoActive
      key={visitSessionKeyForStation(2, visits)}
      phaseDurationMs={phaseDurationMs}
    />
  )
}

function StationTwoActive({ phaseDurationMs }: { phaseDurationMs?: number }) {
  const [vibe] = useStationVibe()
  const warm = vibe === 'warm'
  const visits = useVisitCentralPoll()
  const centralMode = shouldGateStationTurn(2)
  const centralOne = peekStationOneForStation(2)
  const centralAnswers = centralOne?.answers
  const centralProfileReady = !centralMode || Boolean(centralAnswers)
  const [state, dispatch] = useReducer(
    firehoseReducer(STATION_ID, stationTwoReducer, actionToEvent),
    undefined,
    initialStationTwoState,
  )
  useLiveJourneyTheme()

  const prevPhaseRef = useRef<StationTwoState['phase'] | null>(null)
  useEffect(() => {
    if (prevPhaseRef.current !== state.phase) {
      if (prevPhaseRef.current !== null) {
        publish(STATION_ID, phaseEvent(state.phase), { phase: state.phase })
      }
      prevPhaseRef.current = state.phase
    }
    if (state.phase === 'complete') {
      publish(STATION_ID, 'interview_done', {
        answers: state.answers,
        lightningAnswers: state.lightningAnswers,
        height: state.height,
      })
    }
  }, [state.phase, state.answers, state.lightningAnswers, state.height])

  useEffect(() => {
    saveStationTwoState(state)
  }, [state])

  useEffect(() => {
    publish(STATION_ID, 'station_mounted', { phase: 'percentile' })
  }, [])

  useEffect(() => {
    if (!centralAnswers) return
    const profile = visitorProfileFromAnswers(centralAnswers)
    dispatch({
      type: 'SYNC_VISITOR_PROFILE',
      age: profile.age,
      previousRelationships: profile.previousRelationships,
    })
  }, [centralAnswers, visits])

  useEffect(() => {
    if (!centralProfileReady) return
    const automaticDurationMs = getAutoPhaseDurationMs(state.phase)
    if (automaticDurationMs === undefined) return
    const timer = window.setTimeout(
      () => dispatch({ type: 'ADVANCE' }),
      phaseDurationMs ?? automaticDurationMs,
    )
    return () => window.clearTimeout(timer)
  }, [centralProfileReady, phaseDurationMs, state.phase])

  const answer = useCallback((value: BinaryAnswer) => dispatch({ type: 'ANSWER', value }), [])
  const submitText = useCallback((value: string) => dispatch({ type: 'SUBMIT_TEXT', value }), [])
  const question = STATION_TWO_QUESTIONS[state.questionIndex]
  const heightStep = scaleStepFromValue(state.height)
  const outlineHeight = valueFromScaleStep(heightStep)
  const questionLines = (warm ? QUESTION_LINES_WARM : QUESTION_LINES_ORIGINAL)[state.questionIndex]
  const lightningPair = STATION_TWO_LIGHTNING[state.lightningIndex]
  const liveScaleFocusRef = useRef({
    value: Number(state.answers[question?.id ?? ''] ?? 0.5),
    prompt: question?.prompt ?? '',
  })
  const liveHeightFocusRef = useRef({ value: state.height, prompt: 'How tall is your ideal partner?' })
  if (question?.type === 'scale') {
    liveScaleFocusRef.current = {
      value: Number(state.answers[question.id] ?? 0.5),
      prompt: question.prompt,
    }
  }
  liveHeightFocusRef.current = {
    value: outlineHeight,
    prompt: 'How tall is your ideal partner?',
  }

  useEffect(() => {
    if (state.phase === 'question' && question?.type === 'scale') {
      const resolveScale = () => ({
        ...HOW_SMART_SCALE,
        value: liveScaleFocusRef.current.value,
        prompt: liveScaleFocusRef.current.prompt,
      })
      return startKeyboardFocusHeartbeat(STATION_ID, 'scale', resolveScale(), undefined, resolveScale)
    }
    if (state.phase === 'question') {
      return startKeyboardFocusHeartbeat(STATION_ID, keyboardFocusForQuestion(question), {
        prompt: question?.prompt,
      })
    }
    if (state.phase === 'height') {
      const resolveHeight = () => ({
        ...HEIGHT_SCALE,
        value: liveHeightFocusRef.current.value,
        prompt: liveHeightFocusRef.current.prompt,
      })
      return startKeyboardFocusHeartbeat(STATION_ID, 'scale', resolveHeight(), undefined, resolveHeight)
    }
    if (state.phase === 'lightning' && lightningPair) {
      return startKeyboardFocusHeartbeat(STATION_ID, 'choice', {
        left: lightningPair.left,
        right: lightningPair.right,
        prompt: `${lightningPair.left} or ${lightningPair.right}?`,
      })
    }
    return startKeyboardFocusHeartbeat(STATION_ID, 'hidden')
  }, [
    lightningPair,
    question,
    state.answers,
    state.height,
    state.lightningIndex,
    state.phase,
    state.questionIndex,
  ])

  return (
    <>
    {/* Also excluded in Vitest (MODE === 'test'): leva's stitches-based
        styling tries to insert a custom-property-only rule that jsdom's
        CSS parser can't handle, which would otherwise crash any test that
        fully mounts <StationTwo/>. Cards/Mirror have the same lazy-panel
        shape but happen to never be runtime-tested at their station-root
        level, so they've never hit this. */}
    {showTuningPanel() && import.meta.env.MODE !== 'test' && !readDeviceLock() ? (
      <Suspense fallback={null}>
        <JourneyDevPanel />
      </Suspense>
    ) : null}
    <MirrorStationShell
      station="II"
      cameraMode="none"
    >
      {state.phase !== 'percentile' && state.phase !== 'complete' ? <DebraGuide /> : null}

      {state.phase === 'percentile' ? (
        <div className="journey-message journey-message-bottom">
          <JourneyHeadline
            lines={
              warm
                ? ['You have been placed', 'in category Rho106.']
                : ['CATEGORY ASSIGNMENT:', 'RHO106.']
            }
          >
            {warm ? 'You have been placed in category Rho106.' : 'Category assignment: Rho106.'}
          </JourneyHeadline>
        </div>
      ) : null}

      {state.phase === 'companion-intro' ? (
        <div className="journey-message journey-message-bottom">
          <JourneyHeadline
            lines={
              warm
                ? ['You will now be matched', 'with an AI partner.']
                : ['SUBJECT UNFIT FOR', 'UNASSISTED PAIRING.', 'OPTIMAL MATCH', 'COMPILING.']
            }
          >
            {warm
              ? 'You will now be matched with an AI partner.'
              : 'Subject unfit for unassisted pairing. Optimal match compiling.'}
          </JourneyHeadline>
        </div>
      ) : null}

      {state.phase === 'debra-brief' ? (
        <div className="journey-debra-copy">
          <JourneyHeadline
            lines={
              warm
                ? ['But first we need you to', 'answer a few questions...']
                : ['ADDITIONAL INPUT REQUIRED', 'BEFORE ALLOCATION CAN PROCEED.']
            }
          >
            {warm
              ? 'But first we need you to answer a few questions...'
              : 'Additional input required before allocation can proceed.'}
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
          <MirrorScale
            value={Number(state.answers[question.id] ?? 0.5)}
            leftLabel={HOW_SMART_SCALE.left}
            rightLabel={HOW_SMART_SCALE.right}
            onChange={(value) => dispatch({ type: 'SET_SCALE', value })}
          />
          <JourneyButton
            className="journey-height-confirm"
            type="button"
            onClick={() => dispatch({ type: 'ADVANCE' })}
          >
            {warm ? 'That feels right' : 'Confirm'}
          </JourneyButton>
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
            <MirrorScale
              value={state.height}
              leftLabel={HEIGHT_SCALE.left}
              rightLabel={HEIGHT_SCALE.right}
              onChange={(value) => dispatch({ type: 'SET_HEIGHT', value })}
            />
            <JourneyButton
              className="journey-height-confirm"
              type="button"
              onClick={() => dispatch({ type: 'ADVANCE' })}
            >
              {warm ? 'That feels right' : 'Confirm height'}
            </JourneyButton>
          </div>
        </div>
      ) : null}

      {state.phase === 'lightning-intro' ? (
        <div className="journey-message journey-message-bottom">
          <JourneyHeadline
            lines={
              warm
                ? ['Just a few quick', 'questions more...']
                : ['FINAL ASSESSMENT', 'MODULE REMAINING.']
            }
          >
            {warm ? 'Just a few quick questions more...' : 'Final assessment module remaining.'}
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
          {readDeviceLock() ? null : (
            <JourneyButton as="a" href="#/mirror">
              Continue to Station III
            </JourneyButton>
          )}
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
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [prompt])
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
        ref={inputRef}
        id="station-two-text-question"
        className="journey-intake-field"
        aria-label={prompt}
        autoFocus
        autoComplete="off"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      {draft ? (
        <p className="journey-intake-preview" aria-live="polite">{draft}</p>
      ) : (
        <p className="journey-ipad-hint">Type on the iPad</p>
      )}
      <JourneyButton type="submit">Continue</JourneyButton>
    </form>
  )
}
