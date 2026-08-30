import { describe, expect, it } from 'vitest'
import { createStationTwoState } from './mirrorJourney'
import { buildPhotobashScript, flattenPhotobashScript } from './photobashScript'
import type { VisitorProfile } from './visitorProfile'

const emptyProfile: VisitorProfile = {
  callName: '',
  age: null,
  identity: '',
  orientation: '',
  doubtedOrientation: null,
  previousRelationships: null,
  origin: '',
  livesWhereBorn: null,
  washFrequency: '',
  lastInsecure: '',
}

describe('buildPhotobashScript', () => {
  it('always includes a fixed beginning and ending', () => {
    const script = buildPhotobashScript({ profile: emptyProfile, stationTwo: null })
    expect(script.opening[0]).toBe('I have been listening. Let me show you who we made.')
    expect(script.closing[0]).toBe('This is the companion we negotiated. Look closely.')
    expect(flattenPhotobashScript(script).join(' ')).not.toContain('\u2014')
  })

  it('names the visitor and branches on orientation, height, and lightning', () => {
    const script = buildPhotobashScript({
      profile: { ...emptyProfile, callName: 'Ada', orientation: 'gay' },
      stationTwo: createStationTwoState({
        height: 0.8,
        answers: { attractiveness: 'no' },
        lightningAnswers: { beautyMoney: 'Beauty' },
      }),
      hasVoice: true,
    })
    expect(script.opening).toContain('Hello, Ada.')
    expect(script.middle).toContain('You said your orientation is gay.')
    expect(script.middle).toContain('You asked for someone taller than you.')
    expect(script.middle).toContain('You said looks were not the point.')
    expect(script.middle.some((line) => line.includes('beauty'))).toBe(true)
    expect(script.closing).toContain('And this is you, introducing yourself.')
  })

  it('quotes a Station III dictation in the middle of the script', () => {
    const script = buildPhotobashScript({
      profile: emptyProfile,
      stationTwo: null,
      transcript: 'I want someone kind',
    })
    expect(script.middle).toContain('You introduced yourself.')
    expect(script.middle).toContain('You said: I want someone kind')
  })

  it('skips optional lines when the interview is empty', () => {
    const script = buildPhotobashScript({ profile: emptyProfile, stationTwo: null, hasVoice: false })
    expect(script.opening).toEqual(['I have been listening. Let me show you who we made.'])
    expect(script.middle).toEqual([])
    expect(script.closing).toEqual(['This is the companion we negotiated. Look closely.'])
  })
})
