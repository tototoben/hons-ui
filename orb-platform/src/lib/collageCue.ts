import {
  FACE_AGE_BANDS,
  FACE_HAIR_COLORS,
  FACE_PRESENTATIONS,
  type FaceAgeBand,
  type FaceHairColor,
  type FacePresentation,
} from './faceBank'
import { loadStationTwoState, peekStationTwoState } from './interviewStore'
import {
  peekStationOneForStation,
  peekStationTwoForStation,
  refreshVisitCache,
} from './visitCentral'
import { getVisitorProfile } from './visitorProfile'

/**
 * Compact visual query the collage wall uses to pick stranger fragments.
 * Built from Station I identity/age and Station II attractiveness; hair
 * colour is reserved for when card answers are stored.
 */
export type CollageCue = {
  presentation?: FacePresentation
  ageBand?: FaceAgeBand
  hairColor?: FaceHairColor
  smile?: boolean
}

export type CollageAnswers = {
  identity?: string
  age?: number | null
  attractiveness?: string
  hairColor?: string
  lightningAnswers?: Record<string, string>
}

const WOMAN_RE =
  /\b(women|woman|female|girl|lady|femme|trans[\s-]?woman|trans[\s-]?female|she\/her|she)\b/i
const MAN_RE =
  /\b(men|man|male|boy|guy|masc|trans[\s-]?man|trans[\s-]?male|he\/him|he)\b/i
const ANDROGYNOUS_RE =
  /\b(non[\s-]?binary|enby|\bnb\b|agender|genderfluid|genderqueer|androgynous|they\/them|they)\b/i

export function presentationFromIdentity(identity: string | undefined): FacePresentation | undefined {
  const text = identity?.trim() ?? ''
  if (!text) return undefined
  if (ANDROGYNOUS_RE.test(text)) return 'androgynous'
  if (WOMAN_RE.test(text)) return 'woman'
  if (MAN_RE.test(text)) return 'man'
  const lower = text.toLowerCase()
  if (lower === 'f' || lower === 'w') return 'woman'
  if (lower === 'm') return 'man'
  return undefined
}

/** Child/older tags exist on the schema; this bank only has young + mid stills. */
export function ageBandFromAge(age: number | null | undefined): FaceAgeBand | undefined {
  if (age == null || !Number.isFinite(age) || age <= 0) return undefined
  if (age < 18) return 'young'
  if (age < 35) return 'young'
  if (age < 55) return 'mid'
  return 'older'
}

function hairColorFromText(value: string | undefined): FaceHairColor | undefined {
  if (!value) return undefined
  const text = value.trim().toLowerCase()
  if ((FACE_HAIR_COLORS as readonly string[]).includes(text)) return text as FaceHairColor
  if (/\b(blonde|blond|yellow)\b/.test(text)) return 'blonde'
  if (/\b(redhead|ginger|auburn)\b/.test(text)) return 'red'
  if (/\b(grey|gray|silver|white)\b/.test(text)) return 'gray'
  if (/\b(brunette|brown)\b/.test(text)) return 'brown'
  if (/\b(black|dark)\b/.test(text)) return 'black'
  if (/\b(bald|none|no hair)\b/.test(text)) return 'none'
  return undefined
}

function smileFromAnswers(answers: CollageAnswers): boolean | undefined {
  if (answers.attractiveness === 'yes') return true
  if (answers.attractiveness === 'no') return false
  const beauty = answers.lightningAnswers?.beautyMoney
  if (beauty === 'Beauty') return true
  if (beauty === 'Money') return false
  return undefined
}

export function collageCueFromAnswers(answers: CollageAnswers): CollageCue {
  const cue: CollageCue = {}
  const presentation = presentationFromIdentity(answers.identity)
  const ageBand = ageBandFromAge(answers.age)
  const hairColor = hairColorFromText(answers.hairColor)
  const smile = smileFromAnswers(answers)
  if (presentation) cue.presentation = presentation
  if (ageBand) cue.ageBand = ageBand
  if (hairColor) cue.hairColor = hairColor
  if (smile !== undefined) cue.smile = smile
  return cue
}

export function parseCollageCue(value: unknown): CollageCue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const raw = value as Record<string, unknown>
  const cue: CollageCue = {}
  if (typeof raw.presentation === 'string' && (FACE_PRESENTATIONS as readonly string[]).includes(raw.presentation)) {
    cue.presentation = raw.presentation as FacePresentation
  }
  if (typeof raw.ageBand === 'string' && (FACE_AGE_BANDS as readonly string[]).includes(raw.ageBand)) {
    cue.ageBand = raw.ageBand as FaceAgeBand
  }
  if (typeof raw.hairColor === 'string' && (FACE_HAIR_COLORS as readonly string[]).includes(raw.hairColor)) {
    cue.hairColor = raw.hairColor as FaceHairColor
  }
  if (raw.smile === true) cue.smile = true
  if (raw.smile === false) cue.smile = false
  return cue
}

export function isEmptyCollageCue(cue: CollageCue | null | undefined): boolean {
  if (!cue) return true
  return (
    cue.presentation === undefined &&
    cue.ageBand === undefined &&
    cue.hairColor === undefined &&
    cue.smile === undefined
  )
}

export function collageCueKey(cue: CollageCue | null | undefined): string {
  if (!cue || isEmptyCollageCue(cue)) return ''
  return [cue.presentation ?? '', cue.ageBand ?? '', cue.hairColor ?? '', cue.smile === undefined ? '' : String(cue.smile)].join('|')
}

export function collageCueFromLocalAnswers(): CollageCue {
  const centralOne = peekStationOneForStation('reveal')
  const centralTwo = peekStationTwoForStation('reveal')
  if (centralOne?.answers || centralTwo) {
    const ageValue = Number(centralOne?.answers?.age)
    return collageCueFromAnswers({
      identity: centralOne?.answers?.identity,
      age: Number.isFinite(ageValue) && ageValue > 0 ? ageValue : null,
      attractiveness: centralTwo?.answers?.attractiveness,
      lightningAnswers: centralTwo?.lightningAnswers,
    })
  }

  const profile = getVisitorProfile()
  const stationTwo = peekStationTwoState() ?? loadStationTwoState()
  return collageCueFromAnswers({
    identity: profile.identity,
    age: profile.age ?? stationTwo?.age ?? null,
    attractiveness: stationTwo?.answers.attractiveness,
    lightningAnswers: stationTwo?.lightningAnswers,
  })
}

/** Async refresh then build a collage cue from central when available. */
export async function collageCueFromVisitCentral(): Promise<CollageCue> {
  await refreshVisitCache(true)
  return collageCueFromLocalAnswers()
}
