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
 * Built from Station I identity, age, and orientation plus Station II
 * attractiveness; hair colour is reserved for when card answers are stored.
 */
export type CollageCue = {
  /** Legacy single-value filter; prefer `presentations` when set. */
  presentation?: FacePresentation
  /** Target stranger presentation(s) derived from identity + orientation. */
  presentations?: FacePresentation[]
  ageBand?: FaceAgeBand
  hairColor?: FaceHairColor
  smile?: boolean
  /** When true, stranger selection keeps the presentation filter on fallback. */
  lockPresentation?: boolean
}

export type CollageAnswers = {
  identity?: string
  age?: number | null
  orientation?: string
  attractiveness?: string
  hairColor?: string
  lightningAnswers?: Record<string, string>
}

export type NormalizedOrientation =
  | 'heterosexual'
  | 'homosexual'
  | 'bisexual'
  | 'pansexual'
  | 'asexual'
  | 'unknown'

const WOMAN_RE =
  /\b(women|woman|female|girl|lady|femme|trans[\s-]?woman|trans[\s-]?female|she\/her|she)\b/i
const MAN_RE =
  /\b(men|man|male|boy|guy|masc|trans[\s-]?man|trans[\s-]?male|he\/him|he)\b/i
const ANDROGYNOUS_RE =
  /\b(non[\s-]?binary|enby|\bnb\b|agender|genderfluid|genderqueer|androgynous|they\/them|they)\b/i

const HETERO_RE = /\b(straight|hetero(sexual)?)\b/i
const HOMO_RE = /\b(gay|homosexual|lesbian|sapphic)\b/i
const BI_RE = /\b(bi(sexual)?|ambisexual)\b/i
const PAN_RE = /\b(pan(sexual)?|omnisexual)\b/i
const ACE_RE = /\b(asexual|ace|aromantic|demisexual)\b/i
const QUEER_RE = /\b(queer|questioning|fluid)\b/i
const ATTRACTED_TO_WOMEN_RE = /\b(women|woman|females?|femmes?|girls?|ladies)\b/i
const ATTRACTED_TO_MEN_RE = /\b(men|man|males?|guys?|boys?)\b/i

const ALL_PRESENTATIONS: FacePresentation[] = ['woman', 'man', 'androgynous']

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

export function normalizeOrientation(text: string | undefined): NormalizedOrientation {
  const value = text?.trim() ?? ''
  if (!value) return 'unknown'
  if (ACE_RE.test(value)) return 'asexual'
  if (BI_RE.test(value)) return 'bisexual'
  if (PAN_RE.test(value) || QUEER_RE.test(value)) return 'pansexual'
  if (HETERO_RE.test(value)) return 'heterosexual'
  if (HOMO_RE.test(value)) return 'homosexual'
  return 'unknown'
}

/** Reads explicit attraction wording when orientation is free-form. */
export function presentationsFromAttractionText(text: string | undefined): FacePresentation[] {
  const value = text?.trim() ?? ''
  if (!value) return []
  const wantsWomen = ATTRACTED_TO_WOMEN_RE.test(value)
  const wantsMen = ATTRACTED_TO_MEN_RE.test(value)
  if (wantsWomen && wantsMen) return [...ALL_PRESENTATIONS]
  if (wantsWomen) return ['woman']
  if (wantsMen) return ['man']
  return []
}

/** Which stranger presentation(s) the photobank should draw from. */
export function targetPresentationsFromAnswers(
  identity: string | undefined,
  orientation: string | undefined,
): FacePresentation[] | undefined {
  const direct = presentationsFromAttractionText(orientation)
  if (direct.length > 0) return direct

  const visitor = presentationFromIdentity(identity)
  const normalized = normalizeOrientation(orientation)

  switch (normalized) {
    case 'bisexual':
    case 'pansexual':
    case 'asexual':
      return [...ALL_PRESENTATIONS]
    case 'heterosexual':
      if (visitor === 'woman') return ['man']
      if (visitor === 'man') return ['woman']
      return [...ALL_PRESENTATIONS]
    case 'homosexual':
      if (visitor === 'woman') return ['woman']
      if (visitor === 'man') return ['man']
      if (/\blesbian\b/i.test(orientation ?? '')) return ['woman']
      if (/\bgay\b/i.test(orientation ?? '')) return ['man']
      return [...ALL_PRESENTATIONS]
    case 'unknown':
    default:
      if (visitor) return [visitor]
      return undefined
  }
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
  const presentations = targetPresentationsFromAnswers(answers.identity, answers.orientation)
  const ageBand = ageBandFromAge(answers.age)
  const hairColor = hairColorFromText(answers.hairColor)
  const smile = smileFromAnswers(answers)
  if (presentations?.length) {
    cue.presentations = presentations
    cue.lockPresentation = normalizeOrientation(answers.orientation) !== 'unknown'
  }
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
  if (Array.isArray(raw.presentations)) {
    const parsed = raw.presentations.filter(
      (entry): entry is FacePresentation =>
        typeof entry === 'string' && (FACE_PRESENTATIONS as readonly string[]).includes(entry),
    )
    if (parsed.length > 0) cue.presentations = [...new Set(parsed)]
  }
  if (typeof raw.ageBand === 'string' && (FACE_AGE_BANDS as readonly string[]).includes(raw.ageBand)) {
    cue.ageBand = raw.ageBand as FaceAgeBand
  }
  if (typeof raw.hairColor === 'string' && (FACE_HAIR_COLORS as readonly string[]).includes(raw.hairColor)) {
    cue.hairColor = raw.hairColor as FaceHairColor
  }
  if (raw.smile === true) cue.smile = true
  if (raw.smile === false) cue.smile = false
  if (raw.lockPresentation === true) cue.lockPresentation = true
  return cue
}

export function isEmptyCollageCue(cue: CollageCue | null | undefined): boolean {
  if (!cue) return true
  return (
    cue.presentation === undefined &&
    cue.presentations === undefined &&
    cue.ageBand === undefined &&
    cue.hairColor === undefined &&
    cue.smile === undefined &&
    cue.lockPresentation === undefined
  )
}

function presentationCueKey(cue: CollageCue): string {
  if (cue.presentations?.length) return cue.presentations.slice().sort().join('+')
  return cue.presentation ?? ''
}

export function collageCueKey(cue: CollageCue | null | undefined): string {
  if (!cue || isEmptyCollageCue(cue)) return ''
  return [
    presentationCueKey(cue),
    cue.ageBand ?? '',
    cue.hairColor ?? '',
    cue.smile === undefined ? '' : String(cue.smile),
    cue.lockPresentation ? '1' : '',
  ].join('|')
}

export function collageCueFromLocalAnswers(): CollageCue {
  const centralOne = peekStationOneForStation('reveal')
  const centralTwo = peekStationTwoForStation('reveal')
  if (centralOne?.answers || centralTwo) {
    const ageValue = Number(centralOne?.answers?.age)
    return collageCueFromAnswers({
      identity: centralOne?.answers?.identity,
      age: Number.isFinite(ageValue) && ageValue > 0 ? ageValue : null,
      orientation: centralOne?.answers?.orientation,
      attractiveness: centralTwo?.answers?.attractiveness,
      lightningAnswers: centralTwo?.lightningAnswers,
    })
  }

  const profile = getVisitorProfile()
  const stationTwo = peekStationTwoState() ?? loadStationTwoState()
  return collageCueFromAnswers({
    identity: profile.identity,
    age: profile.age ?? stationTwo?.age ?? null,
    orientation: profile.orientation,
    attractiveness: stationTwo?.answers.attractiveness,
    lightningAnswers: stationTwo?.lightningAnswers,
  })
}

/** Async refresh then build a collage cue from central when available. */
export async function collageCueFromVisitCentral(): Promise<CollageCue> {
  await refreshVisitCache(true)
  return collageCueFromLocalAnswers()
}
