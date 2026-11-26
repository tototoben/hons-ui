import { lazy, Suspense, useCallback, useEffect, useReducer, useRef, useState, type FormEvent } from 'react'
import { journeySettings } from '../dev/journeySettingsStore'
import { useStationVibe } from '../hooks/useStationVibe'
import { readDeviceLock } from '../lib/deviceLock'
import { getDeviceQuality } from '../lib/deviceQuality'
import { centralApiBase, refreshVisitCache } from '../lib/visitCentral'
import { firehoseReducer, publish } from '../lib/firehose'
import { saveStationOneState, saveStationTwoState } from '../lib/interviewStore'
import {
  keyboardFocusForQuestion,
  publishKeyboardFocus,
  startKeyboardFocusHeartbeat,
} from '../lib/keyboardFocus'
import {
  STATION_ONE_INTAKE,
  STATION_TWO_LIGHTNING,
  STATION_TWO_QUESTIONS,
  type BinaryAnswer,
} from '../lib/mirrorJourney'
import { PHOTOBASH_FILL_MS } from '../lib/photobashLoop'
import {
  createJourneyState,
  journeyPhase,
  journeyReducer,
  type JourneyAction,
  type JourneyPhase,
} from '../lib/singleJourney'
import { revealFromSingleJourney } from '../lib/singleJourneyReveal'
import { getVisitorFaceCapture, resetVisitorFaceCapture } from '../lib/visitorFaceCapture'
import { showTuningPanel } from '../lib/tune'
import { setVisitorProfile, visitorProfileFromAnswers } from '../lib/visitorProfile'
import { DebraGuide } from './DebraGuide'
import { JourneyButton } from './JourneyButton'
import { JourneyHeadline } from './JourneyHeadline'
import { MirrorChoice } from './MirrorChoice'
import { MirrorScale } from './MirrorScale'
import { MirrorStationShell } from './MirrorStationShell'
import { MatchHandoffScreen, MatchLoadingScreen } from './ThirdStation'

const JourneyDevPanel = lazy(() =>
  import('../dev/JourneyDevPanel').then((m) => ({ default: m.JourneyDevPanel })),
)

const LIVE_POLL_MS = 150

/** Bridges journeySettings.colors (tuned live from the dev panel) into the
 * :root custom properties MirrorJourney.css reads. */
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

/** The single kiosk reports as station-1: the station bridge only relays
 * events for the station it hosts. */
const STATION_ID = 'station-1'

const SCAN_PHASE_MS = 2200
/** How long "Meet your match" stays up before the kiosk resets. */
const HANDOFF_HOLD_MS = 10000
const REVEAL_POLL_MS = 2000

function shouldGateForReveal(): boolean {
  const base = centralApiBase()
  if (!base || typeof window === 'undefined') return false
  const explicit = new URLSearchParams(window.location.search).get('central')
  if (explicit && explicit !== '0' && explicit !== 'false') return true
  return getDeviceQuality() === 'kiosk'
}

function useRevealInProgress(pollKey: string): boolean {
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (!shouldGateForReveal()) {
      setActive(false)
      return
    }
    let cancelled = false
    const check = async () => {
      const visits = await refreshVisitCache(true)
      if (cancelled) return
      setActive(visits.some((v) => v.state === 'reveal'))
    }
    void check()
    const id = window.setInterval(() => {
      void check()
    }, REVEAL_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [pollKey])
  return active
}

const HOW_SMART_SCALE = { left: 'Not very', right: 'Extremely' }

function actionToEvent(action: JourneyAction): { event: string; data?: unknown } | null {
  switch (action.type) {
    case 'SUBMIT_TEXT':
      return { event: 'text_submitted', data: { value: action.value.trim() } }
    case 'ANSWER':
      return { event: 'answer', data: { answer: action.value } }
    case 'ADVANCE':
      return { event: 'phase_advance' }
    case 'RESET':
      return { event: 'station_reset' }
    default:
      return null
  }
}

/** Timed screens advance on their own; everything else waits for input. */
function autoAdvanceMs(phase: JourneyPhase): number | undefined {
  switch (phase) {
    case 'analysis-intro':
    case 'scan-face':
    case 'scan-eyes':
    case 'scan-focus':
    case 'complete':
      return SCAN_PHASE_MS
    case 'percentile':
      return journeySettings.timing.percentileMs
    case 'companion-intro':
      return journeySettings.timing.companionIntroMs
    case 'debra-brief':
      return journeySettings.timing.debraBriefMs
    case 'lightning-intro':
      return journeySettings.timing.lightningIntroMs
    case 'loading':
      return PHOTOBASH_FILL_MS
    default:
      return undefined
  }
}

function cameraModeFor(phase: JourneyPhase) {
  if (phase === 'scan-eyes') return 'eyes' as const
  if (phase === 'analysis-intro' || phase === 'scan-face' || phase === 'scan-focus') return 'face' as const
  return 'none' as const
}

export function JourneyStation() {
  return (
    <>
      {/* Excluded in Vitest: leva's styling crashes jsdom's CSS parser. */}
      {showTuningPanel() && import.meta.env.MODE !== 'test' && !readDeviceLock() ? (
        <Suspense fallback={null}>
          <JourneyDevPanel />
        </Suspense>
      ) : null}
      <JourneyScreen />
    </>
  )
}

function JourneyScreen() {
  useLiveJourneyTheme()
  const [vibe] = useStationVibe()
  const warm = vibe === 'warm'
  const caps = useCallback((lines: string[]) => (warm ? lines : lines.map((l) => l.toUpperCase())), [warm])
  const [state, dispatch] = useReducer(
    firehoseReducer(STATION_ID, journeyReducer, actionToEvent),
    undefined,
    createJourneyState,
  )
  const phase = journeyPhase(state)
  const intakeQuestion = state.stage === 'one' ? STATION_ONE_INTAKE[state.one.questionIndex] : undefined
  const stageTwoQuestion =
    state.stage === 'two' && state.two.phase === 'question'
      ? STATION_TWO_QUESTIONS[state.two.questionIndex]
      : undefined
  const question = phase === 'intake' ? intakeQuestion : stageTwoQuestion
  const lightningPair =
    phase === 'lightning' ? STATION_TWO_LIGHTNING[state.two.lightningIndex] : undefined
  const callName = state.one.answers.callName ?? ''
  const revealInProgress = useRevealInProgress(phase === 'handoff' ? 'handoff' : 'idle')
  const waitingForReveal =
    revealInProgress &&
    state.stage === 'one' &&
    phase === 'intake' &&
    Object.keys(state.one.answers).length === 0

  // The proximity sensor is the normal presence source; a visitor typing is
  // the fallback that opens a visit at central if it never fired.
  const presenceFiredRef = useRef(false)
  const announcePresence = useCallback(() => {
    if (presenceFiredRef.current) return
    presenceFiredRef.current = true
    publish(STATION_ID, 'presence_fallback', {})
  }, [])

  useEffect(() => {
    resetVisitorFaceCapture()
    publish(STATION_ID, 'station_mounted', { phase: 'name' })
  }, [])

  const prevPhaseRef = useRef<JourneyPhase | null>(null)
  useEffect(() => {
    if (prevPhaseRef.current === phase) return
    if (prevPhaseRef.current !== null) publish(STATION_ID, `phase:${phase}`, { phase })
    prevPhaseRef.current = phase
  }, [phase])

  // Persist both halves where the rest of the app (ARS payload, collage cue,
  // dev panels) already looks for Station I / II answers.
  useEffect(() => {
    saveStationOneState(state.one)
    if (Object.keys(state.one.answers).length > 0) {
      setVisitorProfile(visitorProfileFromAnswers(state.one.answers))
    }
  }, [state.one])
  useEffect(() => {
    if (state.stage !== 'one') saveStationTwoState(state.two)
  }, [state.stage, state.two])

  // Questions done: report the whole visit once, then queue the reveal.
  const revealSentRef = useRef(false)
  useEffect(() => {
    if (state.stage !== 'loading' || revealSentRef.current) return
    revealSentRef.current = true
    const stationTwo = {
      answers: state.two.answers,
      lightningAnswers: state.two.lightningAnswers,
      height: state.two.height,
    }
    publish(STATION_ID, 'interview_done', {
      answers: state.one.answers,
      faceCapture: getVisitorFaceCapture(),
      stationTwo,
    })
    void revealFromSingleJourney({ stationOneAnswers: state.one.answers, stationTwo })
  }, [state.stage, state.one.answers, state.two])

  useEffect(() => {
    const ms = autoAdvanceMs(phase)
    if (ms === undefined) return
    const timer = window.setTimeout(() => dispatch({ type: 'ADVANCE' }), ms)
    return () => window.clearTimeout(timer)
  }, [phase])

  // Nothing follows the handoff on this screen — reset for the next visitor.
  useEffect(() => {
    if (phase !== 'handoff') return
    const timer = window.setTimeout(() => {
      presenceFiredRef.current = false
      revealSentRef.current = false
      resetVisitorFaceCapture()
      dispatch({ type: 'RESET' })
      publish(STATION_ID, 'station_mounted', { phase: 'name' })
    }, HANDOFF_HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  const scaleValue = Number(state.two.answers[stageTwoQuestion?.id ?? ''] ?? 0.5)
  const liveScaleRef = useRef({ value: scaleValue, prompt: '' })
  liveScaleRef.current = { value: scaleValue, prompt: stageTwoQuestion?.prompt ?? '' }

  const prevWaitingRef = useRef(false)
  useEffect(() => {
    if (waitingForReveal && !prevWaitingRef.current) {
      publish(STATION_ID, 'station_waiting', { reason: 'reveal_in_progress' })
    } else if (!waitingForReveal && prevWaitingRef.current) {
      publish(STATION_ID, 'station_mounted', { phase: 'name' })
    }
    prevWaitingRef.current = waitingForReveal
  }, [waitingForReveal])

  // Tells the iPad remote which control to show for the current screen.
  useEffect(() => {
    if (waitingForReveal) {
      return startKeyboardFocusHeartbeat(STATION_ID, 'hidden')
    }
    if (question?.type === 'scale') {
      const resolve = () => ({ ...HOW_SMART_SCALE, ...liveScaleRef.current })
      return startKeyboardFocusHeartbeat(STATION_ID, 'scale', resolve(), undefined, resolve)
    }
    if (question) {
      return startKeyboardFocusHeartbeat(STATION_ID, keyboardFocusForQuestion(question), {
        prompt: question.prompt,
      })
    }
    if (lightningPair) {
      return startKeyboardFocusHeartbeat(STATION_ID, 'choice', {
        left: lightningPair.left,
        right: lightningPair.right,
        prompt: `${lightningPair.left} or ${lightningPair.right}?`,
      })
    }
    return startKeyboardFocusHeartbeat(STATION_ID, 'hidden')
  }, [waitingForReveal, question, lightningPair])

  const answer = useCallback(
    (value: BinaryAnswer) => {
      announcePresence()
      dispatch({ type: 'ANSWER', value })
    },
    [announcePresence],
  )
  const submitText = useCallback(
    (value: string) => {
      announcePresence()
      dispatch({ type: 'SUBMIT_TEXT', value })
    },
    [announcePresence],
  )

  if (waitingForReveal) {
    return (
      <MirrorStationShell station="I" cameraMode="none">
        <div className="journey-message" aria-live="polite">
          <JourneyHeadline
            lines={
              warm
                ? ['Visit in progress.', 'Please wait a moment.']
                : ['VISIT IN PROGRESS.', 'PLEASE WAIT.']
            }
            growDown
          >
            {warm ? 'Visit in progress. Please wait a moment.' : 'Visit in progress. Please wait.'}
          </JourneyHeadline>
        </div>
      </MirrorStationShell>
    )
  }

  if (phase === 'loading' || phase === 'handoff') {
    return (
      <section className="third-station" aria-label="Station">
        <div className="mirror-frame">
          {phase === 'loading' ? <LoadingProgress warm={warm} /> : <MatchHandoffScreen warm={warm} />}
        </div>
      </section>
    )
  }

  const debraVisible = state.stage === 'two' && phase !== 'percentile'

  return (
    <MirrorStationShell station="I" cameraMode={cameraModeFor(phase)}>
      {debraVisible ? <DebraGuide /> : null}

      {question?.type === 'text' ? (
        <JourneyTextQuestion
          key={`${state.stage}-${question.id}`}
          id={question.id}
          kicker={
            state.stage === 'one' && question.id === 'callName'
              ? "Let's make you a partner for life. Start by answering:"
              : undefined
          }
          prompt={question.prompt}
          lines={caps(question.lines)}
          numeric={'numeric' in question ? question.numeric : undefined}
          onTyping={announcePresence}
          onSubmit={submitText}
        />
      ) : null}

      {question?.type === 'yesno' ? (
        <div className="journey-question">
          <JourneyHeadline lines={caps(question.lines)}>{question.prompt}</JourneyHeadline>
          <MirrorChoice onAnswer={answer} onScreenButtons={false} />
        </div>
      ) : null}

      {question?.type === 'scale' ? (
        <div className="journey-scale">
          <JourneyHeadline lines={caps(question.lines)}>{question.prompt}</JourneyHeadline>
          <MirrorScale
            value={scaleValue}
            leftLabel={HOW_SMART_SCALE.left}
            rightLabel={HOW_SMART_SCALE.right}
            onChange={(value) => dispatch({ type: 'SET_SCALE', value })}
            // A change made on the kiosk itself moves the iPad's control too.
            onLocalChange={(value) =>
              publishKeyboardFocus(STATION_ID, 'scale', { ...HOW_SMART_SCALE, value, prompt: question.prompt })
            }
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

      {phase === 'analysis-intro' ? (
        <Message camera lines={warm ? ["Let's have", 'a look at you'] : ['PROCEEDING WITH', 'FACIAL ANALYSIS']}>
          {warm ? "Let's have a look at you" : 'Proceeding with facial analysis'}
        </Message>
      ) : null}
      {phase === 'scan-face' ? (
        <Message camera lines={warm ? ['Hold still,', callName] : ['HOLD STILL,', callName.toUpperCase()]}>
          {`Hold still, ${callName}`}
        </Message>
      ) : null}
      {phase === 'scan-eyes' ? (
        <Message camera lines={caps(['Keep your eyes on', 'your reflection'])}>
          Keep your eyes on your reflection
        </Message>
      ) : null}
      {phase === 'scan-focus' ? (
        <Message camera lines={warm ? ["I've got", 'a sense of you'] : ['FACIAL PROFILE', 'ASSEMBLED']}>
          {warm ? "I've got a sense of you" : 'Facial profile assembled'}
        </Message>
      ) : null}
      {phase === 'complete' ? (
        <div className="journey-complete">
          <JourneyHeadline lines={warm ? ['Facial analysis', 'complete'] : ['PROFILE', 'LOGGED.']}>
            {warm ? 'Facial analysis complete' : 'Profile logged.'}
          </JourneyHeadline>
        </div>
      ) : null}

      {phase === 'percentile' ? (
        <Message bottom lines={warm ? ['You have been placed', 'in category Rho106.'] : ['CATEGORY ASSIGNMENT:', 'RHO106.']}>
          {warm ? 'You have been placed in category Rho106.' : 'Category assignment: Rho106.'}
        </Message>
      ) : null}
      {phase === 'companion-intro' ? (
        <Message
          bottom
          lines={
            warm
              ? ['You will now be matched', 'with an AI partner.']
              : ['SUBJECT UNFIT FOR', 'UNASSISTED PAIRING.', 'OPTIMAL MATCH', 'COMPILING.']
          }
        >
          {warm
            ? 'You will now be matched with an AI partner.'
            : 'Subject unfit for unassisted pairing. Optimal match compiling.'}
        </Message>
      ) : null}
      {phase === 'debra-brief' ? (
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
      {phase === 'lightning-intro' ? (
        <Message bottom lines={warm ? ['Just a few quick', 'questions more...'] : ['FINAL ASSESSMENT', 'MODULE REMAINING.']}>
          {warm ? 'Just a few quick questions more...' : 'Final assessment module remaining.'}
        </Message>
      ) : null}
      {lightningPair ? (
        <div className="journey-question">
          <JourneyHeadline lines={caps([`${lightningPair.left} or`, `${lightningPair.right.toLowerCase()}?`])}>
            {`${lightningPair.left} or ${lightningPair.right.toLowerCase()}?`}
          </JourneyHeadline>
          <MirrorChoice
            onAnswer={answer}
            labels={[lightningPair.left, lightningPair.right]}
            onScreenButtons={false}
          />
        </div>
      ) : null}
    </MirrorStationShell>
  )
}

function LoadingProgress({ warm }: { warm: boolean }) {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const start = performance.now()
    let raf = 0
    const tick = () => {
      const next = Math.min(1, (performance.now() - start) / PHOTOBASH_FILL_MS)
      setProgress(next)
      if (next < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <MatchLoadingScreen warm={warm} progress={progress} />
}

function Message({
  children,
  lines,
  bottom,
  camera,
}: {
  children: string
  lines: string[]
  bottom?: boolean
  /** Over the live camera: a small caption low on the screen. */
  camera?: boolean
}) {
  const className = ['journey-message', bottom ? 'journey-message-bottom' : '', camera ? 'journey-message-camera' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={className}>
      <JourneyHeadline lines={lines} growDown>
        {children}
      </JourneyHeadline>
    </div>
  )
}

function JourneyTextQuestion({
  id,
  kicker,
  prompt,
  lines,
  numeric,
  onTyping,
  onSubmit,
}: {
  id: string
  kicker?: string
  prompt: string
  lines: string[]
  numeric?: boolean
  onTyping: () => void
  onSubmit: (value: string) => void
}) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit(draft)
    setDraft('')
  }
  const fieldId = `journey-${id}`

  return (
    <form className="journey-intake" onSubmit={submit}>
      {kicker ? <p className="journey-intake-kicker">{kicker}</p> : null}
      <label htmlFor={fieldId}>
        <JourneyHeadline as="span" lines={lines}>
          {prompt}
        </JourneyHeadline>
      </label>
      <input
        ref={inputRef}
        id={fieldId}
        className="journey-intake-field"
        aria-label={prompt}
        name={id}
        type="text"
        inputMode={numeric ? 'numeric' : undefined}
        pattern={numeric ? '[0-9]*' : undefined}
        autoFocus
        autoComplete="off"
        value={draft}
        onChange={(event) => {
          const next = event.target.value
          if (numeric && next !== '' && !/^\d{1,3}$/.test(next)) return
          setDraft(next)
          if (next !== '') onTyping()
        }}
      />
      {draft ? (
        <p className="journey-intake-preview" aria-live="polite">{draft}</p>
      ) : (
        <p className="journey-ipad-hint">Type on the tablet</p>
      )}
    </form>
  )
}
