import { describe, expect, it } from 'vitest'
import { STATION_ONE_INTAKE, STATION_TWO_LIGHTNING, STATION_TWO_QUESTIONS } from './mirrorJourney'
import {
  createJourneyState,
  journeyPhase,
  journeyReducer,
  type JourneyAction,
  type JourneyState,
} from './singleJourney'

const INTAKE: Record<string, string> = {
  callName: 'Ada',
  identity: 'woman',
  orientation: 'bisexual',
  doubtedOrientation: 'no',
  age: '16',
  origin: 'Tallinn',
  previousRelationships: 'yes',
}

function step(state: JourneyState, action: JourneyAction, seen: string[]) {
  const next = journeyReducer(state, action)
  const phase = journeyPhase(next)
  if (seen[seen.length - 1] !== phase) seen.push(phase)
  return next
}

describe('journeyReducer', () => {
  it('runs the whole visit on one screen, from intake to the reveal handoff', () => {
    const seen = ['intake']
    let state = createJourneyState()

    for (const question of STATION_ONE_INTAKE) {
      const value = INTAKE[question.id]
      state = step(
        state,
        question.type === 'text'
          ? { type: 'SUBMIT_TEXT', value }
          : { type: 'ANSWER', value: value as 'yes' | 'no' },
        seen,
      )
    }
    // facial scan → profile logged → Rho106 → companion intro → brief
    for (let i = 0; i < 8; i += 1) state = step(state, { type: 'ADVANCE' }, seen)

    expect(state.stage).toBe('two')
    // Station I answers gate the adult-only questions.
    expect(state.two.age).toBe(16)
    expect(state.two.previousRelationships).toBe('yes')

    while (journeyPhase(state) === 'question') {
      const question = STATION_TWO_QUESTIONS[state.two.questionIndex]
      state = step(
        state,
        question.type === 'yesno'
          ? { type: 'ANSWER', value: 'yes' }
          : question.type === 'text'
            ? { type: 'SUBMIT_TEXT', value: 'daily' }
            : { type: 'ADVANCE' },
        seen,
      )
    }
    expect(state.two.answers.aiPornography).toBeUndefined()

    state = step(state, { type: 'ADVANCE' }, seen)
    for (let i = 0; i < STATION_TWO_LIGHTNING.length; i += 1) {
      state = step(state, { type: 'ANSWER', value: 'yes' }, seen)
    }
    state = step(state, { type: 'ADVANCE' }, seen)

    expect(seen).toEqual([
      'intake',
      'analysis-intro',
      'scan-face',
      'scan-eyes',
      'scan-focus',
      'complete',
      'percentile',
      'companion-intro',
      'debra-brief',
      'question',
      'lightning-intro',
      'lightning',
      'loading',
      'handoff',
    ])
    expect(state.one.answers).toEqual(INTAKE)
    expect(Object.keys(state.two.lightningAnswers)).toHaveLength(STATION_TWO_LIGHTNING.length)
  })

  it('never shows the old "proceed to the next station" screen', () => {
    let state = createJourneyState()
    state = { ...state, one: { ...state.one, phase: 'complete' } }
    state = journeyReducer(state, { type: 'ADVANCE' })
    expect(journeyPhase(state)).toBe('percentile')
  })

  it('starts over for the next visitor on RESET', () => {
    let state = journeyReducer(createJourneyState(), { type: 'SUBMIT_TEXT', value: 'Ada' })
    state = journeyReducer({ ...state, stage: 'handoff' }, { type: 'RESET' })
    expect(state).toEqual(createJourneyState())
  })
})
