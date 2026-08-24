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
  it('asks the ten intake questions in order before starting the facial scan', () => {
    let state = createStationOneState()
    const answers: Record<string, string> = {
      callName: 'Ada',
      age: '34',
      identity: 'woman',
      orientation: 'bisexual',
      doubtedOrientation: 'no',
      previousRelationships: 'yes',
      origin: 'London',
      livesWhereBorn: 'no',
      washFrequency: 'daily',
      lastInsecure: 'yesterday',
    }

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

  it('skips age-gated and follow-up questions for a visitor under 18 with no previous relationships', () => {
    let state = toQuestionPhase(createStationTwoState({ age: 16, previousRelationships: 'no' }))
    const seenIds: string[] = []

    while (state.phase === 'question') {
      const question = STATION_TWO_QUESTIONS[state.questionIndex]
      seenIds.push(question.id)
      if (question.type === 'yesno') {
        state = stationTwoReducer(state, { type: 'ANSWER', value: 'no' })
      } else if (question.type === 'text') {
        state = stationTwoReducer(state, { type: 'SUBMIT_TEXT', value: 'nothing' })
      } else {
        state = stationTwoReducer(state, { type: 'ADVANCE' })
      }
    }

    expect(seenIds).not.toContain('pornography')
    expect(seenIds).not.toContain('aiPornography')
    expect(seenIds).not.toContain('libido')
    expect(seenIds).not.toContain('cheating')
    expect(seenIds).not.toContain('howSmart')
    expect(seenIds).not.toContain('god')
    expect(seenIds).not.toContain('somethingElse')
    expect(state.phase).toBe('height')
  })

  it('asks the AI-pornography follow-up only after an adult answers yes to pornography', () => {
    let state = toQuestionPhase(createStationTwoState({ age: 25, previousRelationships: 'yes' }))
    const answerAll = (answer: 'yes' | 'no') => {
      const seenIds: string[] = []
      let next = state
      while (next.phase === 'question') {
        const question = STATION_TWO_QUESTIONS[next.questionIndex]
        seenIds.push(question.id)
        if (question.type === 'yesno') {
          next = stationTwoReducer(next, { type: 'ANSWER', value: answer })
        } else if (question.type === 'text') {
          next = stationTwoReducer(next, { type: 'SUBMIT_TEXT', value: 'the universe' })
        } else {
          next = stationTwoReducer(next, { type: 'SET_SCALE', value: 0.7 })
          next = stationTwoReducer(next, { type: 'ADVANCE' })
        }
      }
      return { state: next, seenIds }
    }

    const yesRun = answerAll('yes')
    expect(yesRun.seenIds).toContain('pornography')
    expect(yesRun.seenIds).toContain('aiPornography')
    expect(yesRun.seenIds).toContain('cheating')
    expect(yesRun.seenIds).toContain('howSmart')
    expect(yesRun.seenIds).toContain('god')
    expect(yesRun.state.phase).toBe('height')

    state = toQuestionPhase(createStationTwoState({ age: 25, previousRelationships: 'yes' }))
    const noRun = answerAll('no')
    expect(noRun.seenIds).toContain('pornography')
    expect(noRun.seenIds).not.toContain('aiPornography')
    expect(noRun.seenIds).not.toContain('howSmart')
    // higherPower answered "no" skips both "God?" and "Something else?".
    expect(noRun.seenIds).not.toContain('god')
    expect(noRun.seenIds).not.toContain('somethingElse')
  })

  it('asks "Something else?" only when a higher power is affirmed but it is not God', () => {
    let state = toQuestionPhase(createStationTwoState({ age: 25, previousRelationships: 'no' }))
    const seenIds: string[] = []

    while (state.phase === 'question') {
      const question = STATION_TWO_QUESTIONS[state.questionIndex]
      seenIds.push(question.id)
      if (question.id === 'higherPower' || question.id === 'god') {
        state = stationTwoReducer(state, { type: 'ANSWER', value: question.id === 'god' ? 'no' : 'yes' })
      } else if (question.type === 'yesno') {
        state = stationTwoReducer(state, { type: 'ANSWER', value: 'no' })
      } else if (question.type === 'text') {
        state = stationTwoReducer(state, { type: 'SUBMIT_TEXT', value: 'the universe' })
      } else {
        state = stationTwoReducer(state, { type: 'ADVANCE' })
      }
    }

    expect(seenIds).toContain('god')
    expect(seenIds).toContain('somethingElse')
    expect(state.answers.somethingElse).toBe('the universe')
    expect(state.phase).toBe('height')
  })

  it('walks percentile through the lightning round and into the height phase in order', () => {
    let state = createStationTwoState({ age: 30, previousRelationships: 'no' })
    expect(state.phase).toBe('percentile')

    state = stationTwoReducer(state, { type: 'ADVANCE' })
    expect(state.phase).toBe('companion-intro')
    state = stationTwoReducer(state, { type: 'ADVANCE' })
    expect(state.phase).toBe('debra-brief')
    state = stationTwoReducer(state, { type: 'ADVANCE' })
    expect(state.phase).toBe('question')

    while (state.phase === 'question') {
      const question = STATION_TWO_QUESTIONS[state.questionIndex]
      if (question.type === 'yesno') {
        state = stationTwoReducer(state, { type: 'ANSWER', value: 'yes' })
      } else if (question.type === 'text') {
        state = stationTwoReducer(state, { type: 'SUBMIT_TEXT', value: 'answer' })
      } else {
        state = stationTwoReducer(state, { type: 'ADVANCE' })
      }
    }
    expect(state.phase).toBe('height')

    state = stationTwoReducer(state, { type: 'SET_HEIGHT', value: 1.4 })
    expect(state.height).toBe(1)
    state = stationTwoReducer(state, { type: 'ADVANCE' })
    expect(state.phase).toBe('lightning-intro')
    state = stationTwoReducer(state, { type: 'ADVANCE' })
    expect(state.phase).toBe('lightning')

    for (let step = 0; step < STATION_TWO_LIGHTNING.length - 1; step += 1) {
      state = stationTwoReducer(state, { type: 'ANSWER', value: 'yes' })
      expect(state.phase).toBe('lightning')
    }
    state = stationTwoReducer(state, { type: 'ANSWER', value: 'no' })
    expect(state.phase).toBe('complete')
    expect(Object.keys(state.lightningAnswers)).toHaveLength(STATION_TWO_LIGHTNING.length)
    expect(state.lightningAnswers[STATION_TWO_LIGHTNING[0].id]).toBe(STATION_TWO_LIGHTNING[0].left)
    const last = STATION_TWO_LIGHTNING[STATION_TWO_LIGHTNING.length - 1]
    expect(state.lightningAnswers[last.id]).toBe(last.right)
  })
})
