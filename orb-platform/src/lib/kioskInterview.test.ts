import { describe, expect, it } from 'vitest'
import { buildKioskInterview } from './kioskInterview'
import { STATION_ONE_INTAKE } from './mirrorJourney'

describe('buildKioskInterview', () => {
  it('puts Station I/II answers first and the spoken intro last', () => {
    const payload = buildKioskInterview({
      stationOneAnswers: {
        callName: 'Ada',
        age: '34',
        identity: 'woman',
        origin: 'Tallinn',
      },
      stationTwo: {
        answers: { attractiveness: 'yes', partnerSmart: 'yes' },
        lightningAnswers: { beautyMoney: 'Beauty' },
        height: 0.62,
      },
      intro: 'I like walking in the rain and arguing about films.',
    })

    expect(payload.users.name).toBe('Ada')
    expect(payload.users.age).toBe(34)
    expect(payload.conversation[1]).toEqual({
      role: 'assistant',
      content: STATION_ONE_INTAKE[0].prompt,
    })
    expect(payload.conversation[2]).toEqual({ role: 'user', content: 'Ada' })
    expect(payload.conversation.at(-2)).toEqual({
      role: 'assistant',
      content: 'Now is your chance. Introduce yourself to your future partner.',
    })
    expect(payload.conversation.at(-1)).toEqual({
      role: 'user',
      content: 'I like walking in the rain and arguing about films.',
    })
    expect(payload.users.kiosk).toMatchObject({
      intro: 'I like walking in the rain and arguing about films.',
      lightning: { beautyMoney: 'Beauty' },
    })
  })

  it('still writes an intro turn when dictation is empty', () => {
    const payload = buildKioskInterview({ intro: '  ' })
    expect(payload.conversation.at(-1)?.content).toContain('did not speak')
  })
})
