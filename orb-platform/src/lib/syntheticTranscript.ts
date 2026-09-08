import { buildKioskInterview, type KioskInterviewPayload } from './kioskInterview'
import {
  STATION_TWO_LIGHTNING,
  type StationTwoState,
} from './mirrorJourney'

const INTRO_OPENERS = [
  'I keep circling back to the idea that',
  'What I rarely say out loud is',
  'If you asked the people who know me, they would say',
  'The honest version is',
  'I am still figuring out how to say',
]

const INTRO_CLOSERS = [
  'and I am curious who that would sit with.',
  'even when I try to sound more certain.',
  'which is probably why I am here.',
  'without making it sound like a performance.',
  'and hoping someone hears the part underneath.',
]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function pick<T>(items: T[], seed: number, offset = 0): T {
  return items[(seed + offset) % items.length]!
}

function describeIdentity(identity: string): string {
  const normalized = identity.trim().toLowerCase()
  if (!normalized) return 'someone still naming themself'
  if (normalized.includes('non')) return 'someone outside the obvious boxes'
  if (normalized.includes('woman')) return 'a woman'
  if (normalized.includes('man')) return 'a man'
  return `someone who identifies as ${identity.trim()}`
}

export function generateSyntheticIntro(input: {
  stationOneAnswers?: Record<string, string>
  stationTwo?: Pick<StationTwoState, 'answers' | 'lightningAnswers' | 'height'> | null
  seed?: number
}): string {
  const one = input.stationOneAnswers ?? {}
  const two = input.stationTwo
  const seed = input.seed ?? hashString(JSON.stringify({ one, two }))
  const name = one.callName?.trim() || 'I'
  const age = Number(one.age)
  const origin = one.origin?.trim() || 'somewhere I still carry with me'
  const identity = describeIdentity(one.identity ?? '')
  const attractiveness =
    two?.answers.attractiveness === 'yes'
      ? 'attractiveness matters more than I admit'
      : 'I try not to make attraction the whole story'
  const partnerSmart =
    two?.answers.partnerSmart === 'yes'
      ? 'I want a partner who can keep up intellectually'
      : 'I care less about brilliance than steadiness'
  const lightning = STATION_TWO_LIGHTNING
    .map((pair) => two?.lightningAnswers?.[pair.id])
    .filter(Boolean)
    .slice(0, 2)
    .join(' and ')
  const opener = pick(INTRO_OPENERS, seed, 0)
  const closer = pick(INTRO_CLOSERS, seed, 1)
  const ageClause =
    Number.isFinite(age) && age > 0 ? `At ${age}, I am ${identity}` : `I am ${identity}`
  const fragments = [
    `${name} here.`,
    ageClause,
    `I come from ${origin}.`,
    attractiveness,
    partnerSmart,
    lightning ? `Between ${lightning}, I keep choosing sides.` : '',
    `${opener} I want to be met honestly ${closer}`,
  ].filter(Boolean)
  return fragments.join(' ')
}

export function buildKioskInterviewWithIntro(
  intro: string,
  input: {
    stationOneAnswers?: Record<string, string>
    stationTwo?: Pick<StationTwoState, 'answers' | 'lightningAnswers' | 'height'> | null
    seed?: number
  },
): { payload: KioskInterviewPayload; intro: string; transcriptSource: 'spoken' | 'synthetic' } {
  const spoken = intro.trim()
  if (spoken) {
    return {
      payload: buildKioskInterview({ ...input, intro: spoken }),
      intro: spoken,
      transcriptSource: 'spoken',
    }
  }
  const synthetic = generateSyntheticIntro(input)
  return {
    payload: buildKioskInterview({ ...input, intro: synthetic }),
    intro: synthetic,
    transcriptSource: 'synthetic',
  }
}

export function previewInterviewInterpretation(payload: KioskInterviewPayload) {
  const users = payload.users
  const kiosk = (users.kiosk ?? {}) as Record<string, unknown>
  return {
    name: users.name,
    age: users.age,
    identity: users.identity,
    orientation: users.orientation,
    partnerQualities: users.partner_qualities,
    hobbies: users.hobbies,
    idealWeekend: users.ideal_weekend,
    stationOne: kiosk.stationOne,
    stationTwoAnswers: kiosk.stationTwoAnswers,
    lightning: kiosk.lightning,
    height: kiosk.height,
    introPreview: payload.conversation.at(-1)?.content ?? '',
  }
}
