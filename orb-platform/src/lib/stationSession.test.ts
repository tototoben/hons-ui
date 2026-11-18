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
    expect(stationFirehoseId('station-2')).toBe('station-1')
    expect(stationFirehoseId('station-3')).toBe('station-1')
    expect(stationFirehoseId('mirror')).toBe('station-1')
    expect(stationFirehoseId('photobash')).toBeNull()
    expect(stationFirehoseId('orb')).toBeNull()
  })

  it('wipes the journey answers, profile, and face', () => {
    saveStationOneState(createStationOneState({ answers: { callName: 'Ada' } }))
    saveStationTwoState(createStationTwoState({ answers: { attractiveness: 'yes' } }))
    setVisitorProfile({
      ...getVisitorProfile(),
      callName: 'Ada',
      age: 34,
    })
    setVisitorFaceCapture('data:image/jpeg;base64,face')

    expect(resetCurrentStationMemory('station-1')).toBe(true)

    expect(loadStationOneState()).toBeNull()
    expect(loadStationTwoState()).toBeNull()
    expect(getVisitorProfile().callName).toBe('')
    expect(getVisitorFaceCapture()).toBeNull()
  })

  it('treats the old Station III route as the journey', () => {
    saveStationTwoState(createStationTwoState({ answers: { attractiveness: 'yes' } }))
    setVisitorFaceCapture('data:image/jpeg;base64,face')

    expect(resetCurrentStationMemory('mirror')).toBe(true)

    expect(getVisitorFaceCapture()).toBeNull()
    expect(loadStationTwoState()).toBeNull()
  })

  it('leaves wall and picker routes alone', () => {
    expect(resetCurrentStationMemory('wall-sim')).toBe(false)
    expect(resetCurrentStationMemory('photobash')).toBe(false)
  })
})
