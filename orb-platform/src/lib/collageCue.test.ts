import { describe, expect, it } from 'vitest'
import {
  collageCueFromAnswers,
  collageCueKey,
  normalizeOrientation,
  parseCollageCue,
  presentationFromIdentity,
  targetPresentationsFromAnswers,
} from './collageCue'

describe('collageCue', () => {
  it('maps a heterosexual man to woman-tagged strangers', () => {
    expect(
      targetPresentationsFromAnswers('man', 'heterosexual'),
    ).toEqual(['woman'])
    expect(
      collageCueFromAnswers({ identity: 'man', age: 28, orientation: 'straight' }),
    ).toEqual({
      presentations: ['woman'],
      ageBand: 'young',
      lockPresentation: true,
    })
  })

  it('maps a heterosexual woman to man-tagged strangers', () => {
    expect(targetPresentationsFromAnswers('woman', 'straight')).toEqual(['man'])
  })

  it('maps a gay man to man-tagged strangers', () => {
    expect(targetPresentationsFromAnswers('man', 'gay')).toEqual(['man'])
    expect(
      collageCueFromAnswers({ identity: 'man', orientation: 'homosexual' }).presentations,
    ).toEqual(['man'])
  })

  it('maps a lesbian to woman-tagged strangers even without identity', () => {
    expect(targetPresentationsFromAnswers('', 'lesbian')).toEqual(['woman'])
  })

  it('uses the full bank for bisexual and pan visitors', () => {
    expect(targetPresentationsFromAnswers('man', 'bisexual')).toEqual(['woman', 'man', 'androgynous'])
    expect(targetPresentationsFromAnswers('woman', 'pansexual')).toEqual(['woman', 'man', 'androgynous'])
  })

  it('falls back to visitor identity when orientation is unknown', () => {
    expect(targetPresentationsFromAnswers('woman', '')).toEqual(['woman'])
    expect(
      collageCueFromAnswers({ identity: 'woman', age: 40, orientation: '' }),
    ).toEqual({
      presentations: ['woman'],
      ageBand: 'mid',
      lockPresentation: false,
    })
  })

  it('reads explicit attraction wording from free-form orientation text', () => {
    expect(targetPresentationsFromAnswers('man', 'mostly attracted to women')).toEqual(['woman'])
    expect(targetPresentationsFromAnswers('woman', 'into men and women')).toEqual([
      'woman',
      'man',
      'androgynous',
    ])
  })

  it('normalizes common orientation answers', () => {
    expect(normalizeOrientation('straight')).toBe('heterosexual')
    expect(normalizeOrientation('gay')).toBe('homosexual')
    expect(normalizeOrientation('bi')).toBe('bisexual')
    expect(normalizeOrientation('queer')).toBe('pansexual')
    expect(normalizeOrientation('')).toBe('unknown')
  })

  it('parses presentation arrays and lock flags from persisted cues', () => {
    expect(
      parseCollageCue({
        presentations: ['woman', 'man', 'androgynous'],
        ageBand: 'young',
        smile: true,
        lockPresentation: true,
      }),
    ).toEqual({
      presentations: ['woman', 'man', 'androgynous'],
      ageBand: 'young',
      smile: true,
      lockPresentation: true,
    })
  })

  it('builds stable cue keys for presentation sets', () => {
    expect(
      collageCueKey({
        presentations: ['man', 'woman'],
        ageBand: 'young',
        smile: true,
        lockPresentation: true,
      }),
    ).toBe('man+woman|young||true|1')
  })

  it('still parses identity text into visitor presentation helpers', () => {
    expect(presentationFromIdentity('trans woman')).toBe('woman')
    expect(presentationFromIdentity('non-binary')).toBe('androgynous')
  })
})
