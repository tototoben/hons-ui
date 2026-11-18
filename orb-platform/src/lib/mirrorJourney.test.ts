import { describe, expect, it } from 'vitest'
import {
  createStationOneState,
  createStationTwoState,
  STATION_ONE_INTAKE,
  STATION_TWO_LIGHTNING,
  STATION_TWO_QUESTIONS,
  stationOneReducer,
  stationTwoReducer,
} from './mirrorJourney'

describe('stationOneReducer', () => {
  it('asks the seven intake questions in order before starting the facial scan', () => {
    let state = createStationOneState()
    const answers: Record<string, string> = {
      callName: 'Ada',
      identity: 'woman',
      orientation: 'bisexual',
      doubtedOrientation: 'no',
      age: '34',
      origin: 'London',
      previousRelationships: 'yes',
    }
    expect(STATION_ONE_INTAKE.map((question) => question.id)).toEqual(Object.keys(answers))

    for (const question of STATION_ONE_INTAKE) {
      expect(state.phase).toBe('intake')
      const value = answers[question.id]
      state =
        question.type === 'text'
          ? stationOneReducer(state, { type: 'SUBMIT_TEXT', value })
          : stationOneReducer(state, { type: 'ANSWER', value: value as 'yes' | 'no' })
    }

    expect(state.phase).toBe('analysis-intro')
    expect(state.answers).toEqual(answers)
  })

  it('ignores a blank text answer', () => {
    const state = createStationOneState()
    expect(stationOneReducer(state, { type: 'SUBMIT_TEXT', value: '   ' })).toEqual(state)
  })

  it('ignores a yes/no answer while a text question is showing', () => {
    const state = createStationOneState()
    expect(stationOneReducer(state, { type: 'ANSWER', value: 'yes' })).toEqual(state)
  })

  it('runs the facial scan sequence straight through to completion', () => {
    let state = createStationOneState({ phase: 'analysis-intro' })
    const phases: string[] = []

    for (let step = 0; step < 5; step += 1) {
      state = stationOneReducer(state, { type: 'ADVANCE' })
      phases.push(state.phase)
    }

    expect(phases).toEqual(['scan-face', 'scan-eyes', 'scan-focus', 'complete', 'proceed'])
  })
})

describe('stationTwoReducer', () => {
  function toQuestionPhase(state: ReturnType<typeof createStationTwoState>) {
    let next = state
    for (let step = 0; step < 3; step += 1) {
      next = stationTwoReducer(next, { type: 'ADVANCE' })
    }
    return next
  }

  function answerAll(
    start: ReturnType<typeof createStationTwoState>,
    answer: 'yes' | 'no',
  ) {
    const seenIds: string[] = []
    let state = start
    while (state.phase === 'question') {
      const question = STATION_TWO_QUESTIONS[state.questionIndex]
      seenIds.push(question.id)
      if (question.type === 'yesno') {
        state = stationTwoReducer(state, { type: 'ANSWER', value: answer })
      } else if (question.type === 'text') {
        state = stationTwoReducer(state, { type: 'SUBMIT_TEXT', value: 'daily' })
      } else {
        state = stationTwoReducer(state, { type: 'SET_SCALE', value: 0.7 })
        state = stationTwoReducer(state, { type: 'ADVANCE' })
      }
    }
    return { state, seenIds }
  }

  it('asks every question in order for an adult with previous relationships', () => {
    const { state, seenIds } = answerAll(
      toQuestionPhase(createStationTwoState({ age: 25, previousRelationships: 'yes' })),
      'yes',
    )
    expect(seenIds).toEqual(STATION_TWO_QUESTIONS.map((question) => question.id))
    expect(state.answers.washFrequency).toBe('daily')
    expect(state.answers.howSmart).toBe('0.7')
    expect(state.phase).toBe('lightning-intro')
  })

  it('skips the adult-only questions for a visitor under 18', () => {
    const { seenIds } = answerAll(
      toQuestionPhase(createStationTwoState({ age: 16, previousRelationships: 'yes' })),
      'no',
    )
    expect(seenIds).not.toContain('aiPornography')
    expect(seenIds).not.toContain('cheating')
    expect(seenIds).toContain('howSmart')
    expect(seenIds).toContain('escapism')
  })

  it('asks about cheating only after previous relationships', () => {
    const { seenIds } = answerAll(
      toQuestionPhase(createStationTwoState({ age: 30, previousRelationships: 'no' })),
      'no',
    )
    expect(seenIds).toContain('aiPornography')
    expect(seenIds).not.toContain('cheating')
  })

  it('walks percentile through the questions and the lightning round in order', () => {
    let state = createStationTwoState({ age: 30, previousRelationships: 'no' })
    expect(state.phase).toBe('percentile')

    state = stationTwoReducer(state, { type: 'ADVANCE' })
    expect(state.phase).toBe('companion-intro')
    state = stationTwoReducer(state, { type: 'ADVANCE' })
    expect(state.phase).toBe('debra-brief')
    state = stationTwoReducer(state, { type: 'ADVANCE' })
    expect(state.phase).toBe('question')

    state = answerAll(state, 'yes').state
    expect(state.phase).toBe('lightning-intro')
    state = stationTwoReducer(state, { type: 'ADVANCE' })
    expect(state.phase).toBe('lightning')

    expect(STATION_TWO_LIGHTNING.map((pair) => `${pair.left}/${pair.right}`)).toEqual([
      'Nature/Comfort',
      'Inside/Outside',
      'Rebellion/Simplicity',
      'Sex/Love',
    ])
    for (let step = 0; step < STATION_TWO_LIGHTNING.length - 1; step += 1) {
      state = stationTwoReducer(state, { type: 'ANSWER', value: 'yes' })
      expect(state.phase).toBe('lightning')
    }
    state = stationTwoReducer(state, { type: 'ANSWER', value: 'no' })
    expect(state.phase).toBe('complete')
    expect(Object.keys(state.lightningAnswers)).toHaveLength(STATION_TWO_LIGHTNING.length)
    expect(state.lightningAnswers.natureComfort).toBe('Nature')
    expect(state.lightningAnswers.sexLove).toBe('Love')
  })
})
