import { useCallback, useEffect, useRef, useReducer, useState, type FormEvent } from 'react'
import { useStationVibe } from '../hooks/useStationVibe'
import { firehoseReducer, publish } from '../lib/firehose'
import {
  createStationOneState,
  STATION_ONE_INTAKE,
  stationOneReducer,
  type BinaryAnswer,
  type StationOneAction,
  type StationOneState,
} from '../lib/mirrorJourney'
import { setVisitorProfile, visitorProfileFromAnswers } from '../lib/visitorProfile'
import { JourneyHeadline } from './JourneyHeadline'
import { MirrorChoice } from './MirrorChoice'
import { MirrorStationShell } from './MirrorStationShell'

const STATION_ID = 'station-1'

function actionToEvent(action: StationOneAction): { event: string; data?: unknown } {
  switch (action.type) {
    case 'SUBMIT_TEXT':
      return { event: 'text_submitted', data: { value: action.value.trim() } }
    case 'ANSWER':
      return { event: 'self_check_answer', data: { answer: action.value } }
    case 'ADVANCE':
      return { event: 'phase_advance' }
  }
}

function phaseEvent(phase: StationOneState['phase']): string {
  return `phase:${phase}`
}

const AUTO_PHASES = new Set(['analysis-intro', 'scan-face', 'scan-eyes', 'scan-focus', 'complete'])

const INTAKE_LINES_WARM = [
  ['What do you want', 'us to call you?'],
  ['What is your', 'age?'],
  ['What do you', 'identify as?'],
  ['What is your', 'orientation?'],
  ['Have you ever doubted', 'your orientation?'],
  ['Have you ever had', 'previous relationships?'],
  ['Where are', 'you from?'],
  ['Do you live where', 'you were born?'],
  ['How often do you', 'wash yourself?'],
  ['When was the last time', 'you felt insecure?'],
]
const INTAKE_LINES_ORIGINAL = INTAKE_LINES_WARM.map((lines) => lines.map((line) => line.toUpperCase()))

export function StationOne({ phaseDurationMs = 2200 }: { phaseDurationMs?: number }) {
  const [vibe] = useStationVibe()
  const warm = vibe === 'warm'
  const [state, dispatch] = useReducer(
    firehoseReducer(STATION_ID, stationOneReducer, actionToEvent),
    undefined,
    createStationOneState,
  )
  const [draft, setDraft] = useState('')
  const question = STATION_ONE_INTAKE[state.questionIndex]
  const callName = state.answers.callName ?? ''

  // Publish phase transitions (fires after every state change that moves phases).
  const prevPhaseRef = useRef<StationOneState['phase'] | null>(null)
  useEffect(() => {
    if (prevPhaseRef.current !== state.phase) {
      if (prevPhaseRef.current !== null) {
        publish(STATION_ID, phaseEvent(state.phase), { phase: state.phase })
      }
      prevPhaseRef.current = state.phase
    }
    // When the station reaches 'complete', publish the interview_done event
    // that central listens for to advance the visit state machine.
    if (state.phase === 'complete') {
      publish(STATION_ID, 'interview_done', { answers: state.answers })
    }
  }, [state.phase, state.answers])

  useEffect(() => {
    if (!AUTO_PHASES.has(state.phase)) return
    const timer = window.setTimeout(() => dispatch({ type: 'ADVANCE' }), phaseDurationMs)
    return () => window.clearTimeout(timer)
  }, [phaseDurationMs, state.phase])

  useEffect(() => {
    if (state.phase === 'analysis-intro') {
      setVisitorProfile(visitorProfileFromAnswers(state.answers))
    }
  }, [state.phase, state.answers])

  // Announce station readiness on mount.
  useEffect(() => {
    publish(STATION_ID, 'station_mounted', { phase: 'name' })
  }, [])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    dispatch({ type: 'SUBMIT_TEXT', value: draft })
    setDraft('')
  }
  const answer = useCallback((value: BinaryAnswer) => dispatch({ type: 'ANSWER', value }), [])
  const cameraMode =
    state.phase === 'scan-eyes'
      ? 'eyes'
      : state.phase === 'scan-face' || state.phase === 'scan-focus'
        ? 'face'
        : 'none'

  return (
    <MirrorStationShell station="I" cameraMode={cameraMode}>
      {state.phase === 'intake' && question?.type === 'text' ? (
        <form className="journey-intake" onSubmit={submit}>
          <label htmlFor={`station-one-${question.id}`}>
            <JourneyHeadline
              as="span"
              lines={(warm ? INTAKE_LINES_WARM : INTAKE_LINES_ORIGINAL)[state.questionIndex]}
            >
              {question.prompt}
            </JourneyHeadline>
          </label>
          <input
            key={question.id}
            id={`station-one-${question.id}`}
            aria-label={question.prompt}
            name={question.id}
            type="text"
            inputMode={question.numeric ? 'numeric' : undefined}
            pattern={question.numeric ? '[0-9]*' : undefined}
            autoFocus
            autoComplete="off"
            value={draft}
            onChange={(event) => {
              const next = event.target.value
              if (question.numeric && next !== '' && !/^\d{1,3}$/.test(next)) return
              setDraft(next)
            }}
          />
          <button type="submit">Continue</button>
        </form>
      ) : null}

      {state.phase === 'intake' && question?.type === 'yesno' ? (
        <div className="journey-question">
          <JourneyHeadline lines={(warm ? INTAKE_LINES_WARM : INTAKE_LINES_ORIGINAL)[state.questionIndex]}>
            {question.prompt}
          </JourneyHeadline>
          <MirrorChoice onAnswer={answer} hideButtons />
        </div>
      ) : null}

      {state.phase === 'analysis-intro' ? (
        <JourneyMessage
          lines={warm ? ["Let's have", 'a look at you'] : ['PROCEEDING WITH', 'FACIAL ANALYSIS']}
        >
          {warm ? "Let's have a look at you" : 'Proceeding with facial analysis'}
        </JourneyMessage>
      ) : null}
      {state.phase === 'scan-face' ? (
        <JourneyMessage lines={warm ? ['Hold still,', callName] : ['HOLD STILL,', callName.toUpperCase()]}>
          {`Hold still, ${callName}`}
        </JourneyMessage>
      ) : null}
      {state.phase === 'scan-eyes' ? (
        <JourneyMessage
          lines={warm ? ['Keep your eyes on', 'your reflection'] : ['KEEP YOUR EYES ON', 'YOUR REFLECTION']}
        >
          Keep your eyes on your reflection
        </JourneyMessage>
      ) : null}
      {state.phase === 'scan-focus' ? (
        <JourneyMessage
          lines={warm ? ["I've got", 'a sense of you'] : ['FACIAL PROFILE', 'ASSEMBLED']}
        >
          {warm ? "I've got a sense of you" : 'Facial profile assembled'}
        </JourneyMessage>
      ) : null}
      {state.phase === 'complete' ? (
        <div className="journey-complete">
          <JourneyHeadline lines={warm ? ['Facial analysis', 'complete'] : ['FACIAL ANALYSIS', 'COMPLETE']}>
            Facial analysis complete
          </JourneyHeadline>
        </div>
      ) : null}
      {state.phase === 'proceed' ? (
        <div className="journey-complete">
          <JourneyHeadline lines={warm ? ['Proceed to the', 'next station'] : ['PROCEED TO THE', 'NEXT STATION']}>
            Proceed to the next station
          </JourneyHeadline>
        </div>
      ) : null}
    </MirrorStationShell>
  )
}

function JourneyMessage({ children, lines }: { children: string; lines: string[] }) {
  return (
    <div className="journey-message">
      <JourneyHeadline lines={lines}>{children}</JourneyHeadline>
    </div>
  )
}
