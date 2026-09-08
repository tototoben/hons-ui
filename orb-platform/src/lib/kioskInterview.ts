import {
  STATION_ONE_INTAKE,
  STATION_TWO_LIGHTNING,
  STATION_TWO_QUESTIONS,
  type StationTwoState,
} from './mirrorJourney'
import { peekStationOneState, peekStationTwoState } from './interviewStore'
import { peekStationOneForStation, peekStationTwoForStation, refreshVisitCache } from './visitCentral'
import { getVisitorProfile } from './visitorProfile'
import { getVisitorIntro } from './visitorIntro'

export type ArsChatMessage = {
  role: 'system' | 'assistant' | 'user'
  content: string
}

export type KioskInterviewPayload = {
  users: Record<string, unknown>
  conversation: ArsChatMessage[]
}

export const KIOSK_INTERVIEW_SYSTEM_PROMPT =
  'House of Negotiated Selves kiosk interview. Station I and II typed answers come first and are canonical. Station III is a spoken self-introduction to a future partner. If the transcript contradicts a typed answer (name, age, origin, identity, orientation, yes/no, height, lightning), keep the typed value and ignore the spoken claim. Speech may only add tone and how they present themselves.'

function pushQa(conversation: ArsChatMessage[], prompt: string, answer: string) {
  const text = answer.trim()
  if (!text) return
  conversation.push({ role: 'assistant', content: prompt })
  conversation.push({ role: 'user', content: text })
}

export function buildKioskInterview(input: {
  stationOneAnswers?: Record<string, string>
  stationTwo?: Pick<StationTwoState, 'answers' | 'lightningAnswers' | 'height'> | null
  intro?: string
  systemPrompt?: string
}): KioskInterviewPayload {
  const one = input.stationOneAnswers ?? {}
  const two = input.stationTwo
  const intro = input.intro?.trim() ?? ''
  const conversation: ArsChatMessage[] = [
    {
      role: 'system',
      content: input.systemPrompt?.trim() || KIOSK_INTERVIEW_SYSTEM_PROMPT,
    },
  ]

  for (const question of STATION_ONE_INTAKE) {
    pushQa(conversation, question.prompt, one[question.id] ?? '')
  }

  if (two) {
    for (const question of STATION_TWO_QUESTIONS) {
      pushQa(conversation, question.prompt, two.answers[question.id] ?? '')
    }
    pushQa(
      conversation,
      'How tall should your partner be, from short to tall?',
      Number.isFinite(two.height) ? `${Math.round(two.height * 100)}% toward tall` : '',
    )
    for (const pair of STATION_TWO_LIGHTNING) {
      pushQa(conversation, `${pair.left} or ${pair.right}?`, two.lightningAnswers[pair.id] ?? '')
    }
  }

  conversation.push({
    role: 'assistant',
    content: 'Now is your chance. Introduce yourself to your future partner.',
  })
  conversation.push({
    role: 'user',
    content: intro || '(the visitor did not speak, or dictation was unavailable)',
  })

  const ageValue = Number(one.age)
  const users: Record<string, unknown> = {
    name: one.callName || 'visitor',
    age: Number.isFinite(ageValue) && ageValue > 0 ? ageValue : 0,
    hobbies: [one.origin, one.washFrequency].filter(Boolean).join(' · '),
    ideal_weekend: Object.values(two?.lightningAnswers ?? {}).filter(Boolean).join(', '),
    partner_qualities: [
      two?.answers.partnerSmart === 'yes' ? 'values a smart partner' : '',
      two?.answers.traditional === 'yes' ? 'wants a traditional relationship' : '',
      two?.answers.attractiveness === 'yes' ? 'attractiveness matters' : '',
    ]
      .filter(Boolean)
      .join('; '),
    identity: one.identity ?? '',
    orientation: one.orientation ?? '',
    kiosk: {
      stationOne: one,
      stationTwoAnswers: two?.answers ?? {},
      lightning: two?.lightningAnswers ?? {},
      height: two?.height ?? null,
      intro,
      typedWins: true,
    },
  }

  return { users, conversation }
}

export function buildKioskInterviewFromStores(intro = getVisitorIntro()): KioskInterviewPayload {
  const centralOne = peekStationOneForStation(3)
  const centralTwo = peekStationTwoForStation(3)
  if (centralOne?.answers || centralTwo) {
    return buildKioskInterview({
      stationOneAnswers: centralOne?.answers,
      stationTwo: centralTwo
        ? {
            answers: centralTwo.answers ?? {},
            lightningAnswers: centralTwo.lightningAnswers ?? {},
            height: centralTwo.height ?? 0.5,
          }
        : null,
      intro,
    })
  }

  const peekedOne = peekStationOneState()
  const profile = getVisitorProfile()
  const stationOneAnswers =
    peekedOne?.answers && Object.keys(peekedOne.answers).length > 0
      ? peekedOne.answers
      : {
          callName: profile.callName,
          age: profile.age != null ? String(profile.age) : '',
          identity: profile.identity,
          orientation: profile.orientation,
          doubtedOrientation: profile.doubtedOrientation ?? '',
          previousRelationships: profile.previousRelationships ?? '',
          origin: profile.origin,
          livesWhereBorn: profile.livesWhereBorn ?? '',
          washFrequency: profile.washFrequency,
          lastInsecure: profile.lastInsecure,
        }
  return buildKioskInterview({
    stationOneAnswers,
    stationTwo: peekStationTwoState(),
    intro,
  })
}

/** Refresh central, then build the kiosk payload from the shared visit. */
export async function buildKioskInterviewFromVisit(intro = getVisitorIntro()): Promise<KioskInterviewPayload> {
  await refreshVisitCache(true)
  return buildKioskInterviewFromStores(intro)
}
