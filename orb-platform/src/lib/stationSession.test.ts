// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { resetCurrentStationMemory, stationFirehoseId } from './stationSession'
import {
  loadStationOneState,
  loadStationTwoState,
  saveStationOneState,
  saveStationTwoState,
  STATION_ONE_STORAGE_KEY,
  STATION_TWO_STORAGE_KEY,
} from './interviewStore'
import { createStationOneState, createStationTwoState } from './mirrorJourney'
import {
  getVisitorProfile,
  resetVisitorProfile,
  setVisitorProfile,
  VISITOR_PROFILE_STORAGE_KEY,
} from './visitorProfile'
import { getVisitorFaceCapture, resetVisitorFaceCapture, setVisitorFaceCapture } from './visitorFaceCapture'

afterEach(() => {
  resetVisitorProfile()
  resetVisitorFaceCapture()
  window.localStorage.removeItem(STATION_ONE_STORAGE_KEY)
  window.localStorage.removeItem(STATION_TWO_STORAGE_KEY)
  window.localStorage.removeItem(VISITOR_PROFILE_STORAGE_KEY)
})

describe('stationSession', () => {
  it('maps locked stations onto firehose ids', () => {
    expect(stationFirehoseId('station-1')).toBe('station-1')
    expect(stationFirehoseId('station-2')).toBe('station-2')
    expect(stationFirehoseId('mirror')).toBe('station-3')
    expect(stationFirehoseId('photobash')).toBeNull()
    expect(stationFirehoseId('orb')).toBeNull()
  })

  it('wipes Station I answers, profile, and face', () => {
    saveStationOneState(createStationOneState({ answers: { callName: 'Ada' } }))
    setVisitorProfile({
      ...getVisitorProfile(),
      callName: 'Ada',
      age: 34,
    })
    setVisitorFaceCapture('data:image/jpeg;base64,face')

    expect(resetCurrentStationMemory('station-1')).toBe(true)

    expect(loadStationOneState()).toBeNull()
    expect(getVisitorProfile().callName).toBe('')
    expect(getVisitorFaceCapture()).toBeNull()
  })

  it('wipes only Station II answers so a restart does not resume or duplicate them', () => {
    saveStationTwoState(
      createStationTwoState({
        phase: 'question',
        questionIndex: 4,
        answers: { attractiveness: 'yes' },
      }),
    )
    setVisitorProfile({
      ...getVisitorProfile(),
      callName: 'Ada',
      age: 34,
    })

    expect(resetCurrentStationMemory('station-2')).toBe(true)

    expect(loadStationTwoState()).toBeNull()
    expect(getVisitorProfile().callName).toBe('Ada')
  })

  it('clears the in-memory face on Station III without touching other interviews', () => {
    saveStationTwoState(createStationTwoState({ answers: { attractiveness: 'yes' } }))
    setVisitorFaceCapture('data:image/jpeg;base64,face')

    expect(resetCurrentStationMemory('mirror')).toBe(true)

    expect(getVisitorFaceCapture()).toBeNull()
    expect(loadStationTwoState()?.answers.attractiveness).toBe('yes')
  })

  it('leaves wall and picker routes alone', () => {
    expect(resetCurrentStationMemory('wall-sim')).toBe(false)
    expect(resetCurrentStationMemory('photobash')).toBe(false)
  })
})
