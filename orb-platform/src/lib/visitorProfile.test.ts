// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import {
  getVisitorProfile,
  loadVisitorProfile,
  parseVisitorProfile,
  resetVisitorProfile,
  setVisitorProfile,
  visitorProfileFromAnswers,
  VISITOR_PROFILE_STORAGE_KEY,
} from './visitorProfile'
import { loadStationOneState, saveStationOneState } from './interviewStore'
import { createStationOneState } from './mirrorJourney'

afterEach(() => {
  resetVisitorProfile()
})

describe('visitorProfile persistence', () => {
  it('rebuilds a profile from Station I answers', () => {
    expect(
      visitorProfileFromAnswers({
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
      }),
    ).toMatchObject({
      callName: 'Ada',
      age: 34,
      previousRelationships: 'yes',
    })
  })

  it('writes the profile to localStorage so a refresh can reload it', () => {
    setVisitorProfile(
      visitorProfileFromAnswers({
        callName: 'Ada',
        age: '34',
        previousRelationships: 'yes',
      }),
    )

    expect(loadVisitorProfile().callName).toBe('Ada')
    expect(getVisitorProfile().age).toBe(34)
    expect(window.localStorage.getItem(VISITOR_PROFILE_STORAGE_KEY)).toContain('Ada')
  })

  it('parses a stored profile object', () => {
    expect(
      parseVisitorProfile({
        callName: 'Nia',
        age: 22,
        identity: '',
        orientation: '',
        doubtedOrientation: null,
        previousRelationships: 'no',
        origin: '',
        livesWhereBorn: null,
        washFrequency: '',
        lastInsecure: '',
      }),
    ).toMatchObject({ callName: 'Nia', age: 22, previousRelationships: 'no' })
  })

  it('clears Station I/II interview keys when the profile is reset', () => {
    saveStationOneState(createStationOneState({ answers: { callName: 'Ada' } }))
    resetVisitorProfile()
    expect(loadStationOneState()).toBeNull()
    expect(getVisitorProfile().callName).toBe('')
  })
})
