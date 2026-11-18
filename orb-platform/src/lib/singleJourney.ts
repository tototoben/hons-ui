/**
 * Single-screen journey: the whole visit on one kiosk, ending in the
 * reveal on the separate wall.
 *
 *   intake (Station I questions) → facial scan → profile logged
 *   → Rho106 → companion intro → brief → questions → final assessment
 *   → this-or-that → compiling match → handoff to the reveal wall
 *
 * The two halves reuse the Station I and Station II reducers unchanged;
 * this module only sequences them and adds the loading/handoff tail that
 * used to live on Station III.
 */
import {
  createStationOneState,
  createStationTwoState,
  stationOneReducer,
  stationTwoReducer,
  type BinaryAnswer,
  type StationOneAction,
  type StationOneState,
  type StationTwoAction,
  type StationTwoState,
} from './mirrorJourney'

export type JourneyStage = 'one' | 'two' | 'loading' | 'handoff'

export type JourneyState = {
  stage: JourneyStage
  one: StationOneState
  two: StationTwoState
}

export type JourneyAction =
  | StationOneAction
  | Exclude<StationTwoAction, { type: 'ADVANCE' | 'ANSWER' | 'SUBMIT_TEXT' }>

/** One flat phase name per screen, for firehose `phase:*` events and tests. */
export type JourneyPhase =
  | Exclude<StationOneState['phase'], 'proceed'>
  | Exclude<StationTwoState['phase'], 'complete'>
  | 'loading'
  | 'handoff'

export function createJourneyState(): JourneyState {
  return { stage: 'one', one: createStationOneState(), two: createStationTwoState() }
}

export function journeyPhase(state: JourneyState): JourneyPhase {
  if (state.stage === 'loading' || state.stage === 'handoff') return state.stage
  if (state.stage === 'two') return state.two.phase as JourneyPhase
  return state.one.phase as JourneyPhase
}

function asBinary(value: string | undefined): BinaryAnswer | null {
  return value === 'yes' || value === 'no' ? value : null
}

function startStageTwo(one: StationOneState): StationTwoState {
  const age = Number(one.answers.age)
  return createStationTwoState({
    age: Number.isFinite(age) && age > 0 ? age : null,
    previousRelationships: asBinary(one.answers.previousRelationships),
  })
}

export function journeyReducer(state: JourneyState, action: JourneyAction): JourneyState {
  if (action.type === 'RESET') return createJourneyState()

  if (state.stage === 'one') {
    // Station I used to end on "proceed to the next station"; here the
    // profile-logged beat hands straight over to the Station II messages.
    if (action.type === 'ADVANCE' && state.one.phase === 'complete') {
      return { ...state, stage: 'two', two: startStageTwo(state.one) }
    }
    if (action.type === 'ADVANCE' || action.type === 'ANSWER' || action.type === 'SUBMIT_TEXT') {
      const one = stationOneReducer(state.one, action)
      return one === state.one ? state : { ...state, one }
    }
    return state
  }

  if (state.stage === 'two') {
    if (action.type === 'SYNC_VISITOR_PROFILE') return state
    const two = stationTwoReducer(state.two, action as StationTwoAction)
    if (two === state.two) return state
    return two.phase === 'complete' ? { ...state, two, stage: 'loading' } : { ...state, two }
  }

  if (state.stage === 'loading' && action.type === 'ADVANCE') {
    return { ...state, stage: 'handoff' }
  }

  return state
}
