// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import {
  ageBandFromAge,
  collageCueFromAnswers,
  collageCueFromLocalAnswers,
  collageCueKey,
  parseCollageCue,
  presentationFromIdentity,
} from './collageCue'
import { saveStationTwoState } from './interviewStore'
import { createStationTwoState } from './mirrorJourney'
import { resetVisitorProfile, setVisitorProfile, visitorProfileFromAnswers } from './visitorProfile'

afterEach(() => {
  resetVisitorProfile()
})

describe('collageCue', () => {
  it('reads presentation from free-text identity', () => {
    expect(presentationFromIdentity('woman')).toBe('woman')
    expect(presentationFromIdentity('Trans woman')).toBe('woman')
    expect(presentationFromIdentity('she/her')).toBe('woman')
    expect(presentationFromIdentity('man')).toBe('man')
    expect(presentationFromIdentity('non-binary')).toBe('androgynous')
    expect(presentationFromIdentity('they/them')).toBe('androgynous')
    expect(presentationFromIdentity('pilot')).toBeUndefined()
  })

  it('bins age onto the young / mid / older bands the bank uses', () => {
    expect(ageBandFromAge(16)).toBe('young')
    expect(ageBandFromAge(29)).toBe('young')
    expect(ageBandFromAge(40)).toBe('mid')
    expect(ageBandFromAge(70)).toBe('older')
    expect(ageBandFromAge(null)).toBeUndefined()
  })

  it('builds a cue from Station I and II answers', () => {
    expect(
      collageCueFromAnswers({
        identity: 'woman',
        age: 41,
        attractiveness: 'yes',
      }),
    ).toEqual({ presentation: 'woman', ageBand: 'mid', smile: true })
    expect(
      collageCueFromAnswers({
        identity: 'man',
        age: 22,
        attractiveness: 'no',
      }),
    ).toEqual({ presentation: 'man', ageBand: 'young', smile: false })
    expect(collageCueFromAnswers({ lightningAnswers: { beautyMoney: 'Beauty' } })).toEqual({
      smile: true,
    })
  })

  it('reads the cue from the stored profile and a finished Station II interview', () => {
    setVisitorProfile(visitorProfileFromAnswers({ identity: 'woman', age: '26' }))
    saveStationTwoState(
      createStationTwoState({
        phase: 'complete',
        answers: { attractiveness: 'yes' },
      }),
    )
    expect(collageCueFromLocalAnswers()).toEqual({
      presentation: 'woman',
      ageBand: 'young',
      smile: true,
    })
    expect(collageCueKey(collageCueFromLocalAnswers())).toBe('woman|young||true')
  })

  it('parses a stored reveal cue and ignores unknown fields', () => {
    expect(
      parseCollageCue({
        presentation: 'man',
        ageBand: 'mid',
        smile: false,
        extra: 1,
      }),
    ).toEqual({ presentation: 'man', ageBand: 'mid', smile: false })
    expect(parseCollageCue(null)).toEqual({})
  })
})
