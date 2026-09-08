import { describe, expect, it } from 'vitest'
import { buildKioskInterview } from './kioskInterview'
import {
  buildKioskInterviewWithIntro,
  generateSyntheticIntro,
  previewInterviewInterpretation,
} from './syntheticTranscript'

describe('syntheticTranscript', () => {
  it('builds a deterministic synthetic intro from station answers', () => {
    const intro = generateSyntheticIntro({
      stationOneAnswers: {
        callName: 'Ada',
        age: '28',
        identity: 'woman',
        origin: 'Tallinn',
      },
      stationTwo: {
        answers: { attractiveness: 'yes', partnerSmart: 'yes' },
        lightningAnswers: { beautyOrInside: 'Inside' },
        height: 0.7,
      },
      seed: 7,
    })
    expect(intro).toContain('Ada')
    expect(intro).toContain('Tallinn')
    expect(intro.length).toBeGreaterThan(40)
  })

  it('prefers spoken intro when present', () => {
    const built = buildKioskInterviewWithIntro('I am here to meet someone real.', {
      stationOneAnswers: { callName: 'Ada', age: '28' },
    })
    expect(built.transcriptSource).toBe('spoken')
    expect(built.intro).toContain('meet someone real')
  })

  it('uses central persona prompt when provided', () => {
    const built = buildKioskInterviewWithIntro('', {
      stationOneAnswers: { callName: 'Ada' },
      systemPrompt: 'Satellite 5 persona brief',
    })
    expect(built.payload.conversation[0]?.content).toBe('Satellite 5 persona brief')
  })

  it('summarizes how answers influence the avatar payload', () => {
    const payload = buildKioskInterview({
      stationOneAnswers: { callName: 'Ada', age: '30', identity: 'woman' },
      stationTwo: {
        answers: { attractiveness: 'yes' },
        lightningAnswers: { calmOrChaos: 'Calm' },
        height: 0.6,
      },
      intro: 'Synthetic voice.',
    })
    const summary = previewInterviewInterpretation(payload)
    expect(summary.name).toBe('Ada')
    expect(summary.partnerQualities).toContain('attractiveness matters')
    expect(summary.introPreview).toContain('Synthetic voice')
  })
})
