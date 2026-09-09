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
import { loadStationOneState, saveStationOneState } from '../lib/interviewStore'
import { setVisitorProfile, visitorProfileFromAnswers } from '../lib/visitorProfile'
import { getVisitorFaceCapture } from '../lib/visitorFaceCapture'
import { JourneyHeadline } from './JourneyHeadline'
import { MirrorChoice } from './MirrorChoice'
import { MirrorStationShell } from './MirrorStationShell'
import { keyboardFocusForQuestion, startKeyboardFocusHeartbeat } from '../lib/keyboardFocus'

const STATION_ID = 'station-1'

function actionToEvent(action: StationOneAction): { event: string; data?: unknown } {
  switch (action.type) {
    case 'SUBMIT_TEXT':
      return { event: 'text_submitted', data: { value: action.value.trim() } }
    case 'ANSWER':
      return { event: 'self_check_answer', data: { answer: action.value } }
    case 'ADVANCE':
      return { event: 'phase_advance' }
    case 'RESET':
      return { event: 'station_reset' }
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
    () => loadStationOneState() ?? createStationOneState(),
  )
  const [draft, setDraft] = useState('')
  const question = STATION_ONE_INTAKE[state.questionIndex]
  const callName = state.answers.callName ?? ''
  // The ESP32 proximity sensor is the normal presence-enter source, but it
  // is not reliably firing right now -- a visitor actually typing is a much
  // stronger real-interaction signal than station_mounted, so fall back to
  // it (once) rather than leaving Central with no visit at all.
  const presenceFallbackFiredRef = useRef(false)

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
      publish(STATION_ID, 'interview_done', {
        answers: state.answers,
        faceCapture: getVisitorFaceCapture(),
      })
    }
  }, [state.phase, state.answers])

  useEffect(() => {
    if (!AUTO_PHASES.has(state.phase)) return
    const timer = window.setTimeout(() => dispatch({ type: 'ADVANCE' }), phaseDurationMs)
    return () => window.clearTimeout(timer)
  }, [phaseDurationMs, state.phase])

  // 'proceed' ("proceed to the next station") is a dead end for the state
  // machine -- nothing else ever dispatches ADVANCE for it, so without this
  // the kiosk sits on that screen forever instead of resetting for the next
  // visitor. Central's own visit-abandon/new-visit logic is server-side and
  // never remounts this component (only an explicit room/reset command or
  // a manual restartStation() does), so the reset has to happen locally.
  useEffect(() => {
    if (state.phase !== 'proceed') return
    const timer = window.setTimeout(() => {
      presenceFallbackFiredRef.current = false
      dispatch({ type: 'RESET' })
      publish(STATION_ID, 'station_mounted', { phase: 'name' })
    }, 10000)
    return () => window.clearTimeout(timer)
  }, [state.phase])

  // Hidden operator shortcut: press Shift on its own (arms it), then type
  // "print" and hit Enter, to fire an immediate test print without waiting
  // for a real visit to reach reveal. Armed by Shift's own keydown so it
  // never fires from normal typing (none of the intake questions need
  // Shift) -- any other special key, or a mismatched buffer, disarms it.
  useEffect(() => {
    let armed = false
    let buffer = ''
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Shift') {
        armed = true
        buffer = ''
        return
      }
      if (!armed) return
      if (event.key === 'Enter') {
        if (buffer.toLowerCase() === 'print') {
          publish(STATION_ID, 'test_print_requested', {})
        }
        armed = false
        buffer = ''
        return
      }
      if (event.key.length === 1) {
        buffer += event.key
      } else {
        armed = false
        buffer = ''
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    saveStationOneState(state)
    if (Object.keys(state.answers).length > 0) {
      setVisitorProfile(visitorProfileFromAnswers(state.answers))
    }
  }, [state])

  // Announce station readiness on mount.
  useEffect(() => {
    publish(STATION_ID, 'station_mounted', { phase: 'name' })
  }, [])

  useEffect(() => {
    if (state.phase !== 'intake') {
      return startKeyboardFocusHeartbeat(STATION_ID, 'hidden')
    }
    if (question?.type !== 'text') {
      return startKeyboardFocusHeartbeat(STATION_ID, keyboardFocusForQuestion(question), {
        prompt: question?.prompt,
      })
    }
    return startKeyboardFocusHeartbeat(STATION_ID, 'text', {
      prompt: question.prompt,
    })
  }, [state.phase, state.questionIndex, question])

  const intakeRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (state.phase === 'intake' && question?.type === 'text') {
      intakeRef.current?.focus({ preventScroll: true })
    }
  }, [state.phase, state.questionIndex, question])

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
            ref={intakeRef}
            id={`station-one-${question.id}`}
            className="journey-intake-field"
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
              if (next !== '' && !presenceFallbackFiredRef.current) {
                presenceFallbackFiredRef.current = true
                publish(STATION_ID, 'presence_fallback', {})
              }
            }}
          />
          {draft ? (
            <p className="journey-intake-preview" aria-live="polite">{draft}</p>
          ) : (
            <p className="journey-ipad-hint">Type on the iPad</p>
          )}
          <JourneyButton type="submit">Continue</JourneyButton>
        </form>
      ) : null}

      {state.phase === 'intake' && question?.type === 'yesno' ? (
        <div className="journey-question">
          <JourneyHeadline lines={(warm ? INTAKE_LINES_WARM : INTAKE_LINES_ORIGINAL)[state.questionIndex]}>
            {question.prompt}
          </JourneyHeadline>
          <MirrorChoice onAnswer={answer} />
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
          <JourneyHeadline lines={warm ? ['Facial analysis', 'complete'] : ['PROFILE', 'LOGGED.']}>
            {warm ? 'Facial analysis complete' : 'Profile logged.'}
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
