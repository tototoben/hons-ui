import { describe, expect, it, vi } from 'vitest'
import {
  loadStationOneState,
  loadStationTwoState,
  parseStationOneState,
  parseStationTwoState,
  resetInterview,
  saveStationOneState,
  saveStationTwoState,
  STATION_ONE_STORAGE_KEY,
  STATION_TWO_STORAGE_KEY,
} from './interviewStore'
import { createStationOneState, createStationTwoState } from './mirrorJourney'

function memoryStorage(initial: Record<string, string> = {}) {
  const store = { ...initial }
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    snapshot: () => store,
  }
}

describe('interviewStore', () => {
  it('round-trips Station I intake progress', () => {
    const storage = memoryStorage()
    const state = createStationOneState({
      questionIndex: 4,
      answers: { callName: 'Ada', age: '34' },
    })

    saveStationOneState(state, storage)

    expect(loadStationOneState(storage)).toEqual(state)
    expect(storage.snapshot()[STATION_ONE_STORAGE_KEY]).toContain('Ada')
  })

  it('does not resume a finished Station I visit', () => {
    const storage = memoryStorage()
    saveStationOneState(createStationOneState({ phase: 'proceed', questionIndex: 10 }), storage)
    expect(loadStationOneState(storage)).toBeNull()
    saveStationOneState(createStationOneState({ phase: 'complete', questionIndex: 10 }), storage)
    expect(loadStationOneState(storage)).toBeNull()
    saveStationOneState(createStationOneState({ phase: 'scan-face', questionIndex: 10 }), storage)
    expect(loadStationOneState(storage)).toBeNull()
  })

  it('round-trips Station II answers, height, and lightning picks', () => {
    const storage = memoryStorage()
    const state = createStationTwoState({
      phase: 'lightning',
      questionIndex: 12,
      answers: { attractiveness: 'yes', escapism: 'no' },
      height: 0.72,
      lightningIndex: 2,
      lightningAnswers: { beautyMoney: 'Beauty' },
      age: 25,
      previousRelationships: 'yes',
    })

    saveStationTwoState(state, storage)

    expect(loadStationTwoState(storage)).toEqual(state)
  })

  it('does not resume a finished Station II visit', () => {
    const storage = memoryStorage()
    saveStationTwoState(createStationTwoState({ phase: 'complete' }), storage)
    expect(loadStationTwoState(storage)).toBeNull()
  })

  it('rejects corrupt Station I payloads', () => {
    expect(parseStationOneState(null)).toBeNull()
    expect(parseStationOneState({ phase: 'teleport', questionIndex: 0, answers: {} })).toBeNull()
    expect(parseStationOneState({ phase: 'intake', questionIndex: 0, answers: { age: 12 } })).toBeNull()
  })

  it('rejects corrupt Station II payloads', () => {
    expect(parseStationTwoState({ phase: 'question', questionIndex: 0 })).toBeNull()
    expect(
      parseStationTwoState({
        phase: 'question',
        questionIndex: 0,
        answers: {},
        height: 0.5,
        lightningIndex: 0,
        lightningAnswers: {},
        age: 'old',
        previousRelationships: 'maybe',
      }),
    ).toMatchObject({ age: null, previousRelationships: null })
  })

  it('clears both station keys on reset', () => {
    const storage = memoryStorage()
    saveStationOneState(createStationOneState({ answers: { callName: 'Ada' } }), storage)
    saveStationTwoState(createStationTwoState({ answers: { attractiveness: 'yes' } }), storage)

    resetInterview(storage)

    expect(loadStationOneState(storage)).toBeNull()
    expect(loadStationTwoState(storage)).toBeNull()
    expect(storage.snapshot()[STATION_ONE_STORAGE_KEY]).toBeUndefined()
    expect(storage.snapshot()[STATION_TWO_STORAGE_KEY]).toBeUndefined()
  })

  it('swallows storage throws the same way other kiosk keys do', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }

    expect(loadStationOneState(storage)).toBeNull()
    expect(() => saveStationOneState(createStationOneState(), storage)).not.toThrow()
    expect(() => resetInterview(storage)).not.toThrow()
  })

  it('persists under the interview keys', () => {
    const setItem = vi.fn()
    saveStationOneState(createStationOneState(), {
      getItem: () => null,
      setItem,
      removeItem: vi.fn(),
    })
    expect(setItem).toHaveBeenCalledWith(STATION_ONE_STORAGE_KEY, expect.any(String))
  })
})
