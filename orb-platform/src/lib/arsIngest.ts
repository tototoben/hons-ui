import { publish } from './firehose'
import {
  fetchPersonaForCurrentVisit,
  fetchVisitPersona,
  pickVisitForStationThree,
  peekStationOneForStation,
  peekStationTwoForStation,
  refreshVisitCache,
  stationOnePayload,
  stationTwoPayload,
} from './visitCentral'
import { setVisitorIntro } from './visitorIntro'
import { buildKioskInterviewWithIntro } from './syntheticTranscript'

const ARS_DEFAULT = 'http://127.0.0.1:8190/api/kiosk-interview'
/** Ignore whisper noise on silence — typed Station I/II answers still win. */
const MIN_SPOKEN_INTRO_CHARS = 12
const HALLUCINATION_RE =
  /\b(thanks?\s+for\s+watching|please\s+subscribe|subtitles?\s+by)\b/i

export type KioskVisitContext = {
  visitId: string
  stationOneAnswers?: Record<string, string>
  stationTwo?: {
    answers: Record<string, string>
    lightningAnswers: Record<string, string>
    height: number
  } | null
  systemPrompt?: string
}

/** Snapshot the active visit before slow microphone transcription can age it out. */
export async function prepareKioskVisit(): Promise<KioskVisitContext | null> {
  await refreshVisitCache(true)
  const visit = pickVisitForStationThree()
  if (!visit) return null
  const [persona] = await Promise.all([fetchVisitPersona(visit.visit_id)])
  const one = stationOnePayload(visit)
  const two = stationTwoPayload(visit)
  return {
    visitId: visit.visit_id,
    stationOneAnswers: one?.answers,
    stationTwo: two
      ? {
          answers: two.answers ?? {},
          lightningAnswers: two.lightningAnswers ?? {},
          height: two.height ?? 0.5,
        }
      : null,
    systemPrompt: persona?.system_prompt,
  }
}

export function sanitizeSpokenIntro(intro: string): string {
  const text = intro.trim()
  if (text.length < MIN_SPOKEN_INTRO_CHARS || HALLUCINATION_RE.test(text)) return ''
  return text
}

function ingestUrls(): string[] {
  if (typeof window === 'undefined') return []
  const params = new URLSearchParams(window.location.search)
  const explicit = params.get('ars')
  if (explicit === '0' || explicit === 'false') return []
  if (explicit) return [explicit]
  const urls = ['/orb/__hons/ars-interview', '/__hons/ars-interview']
  if (/^(localhost|127\.0\.0\.1|\[::1\])/i.test(window.location.hostname)) {
    urls.push(ARS_DEFAULT)
  }
  return urls
}

function postJson(url: string, payload: unknown) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => null)
}

export type IntroDiagnostics = {
  finishReason?: 'timer' | 'early'
  speechChars?: number
  whisperChars?: number
  capturedChars?: number
  recordingSeconds?: number
}

/** Persist the spoken intro and hand Station I/II + III to ARS. */
export async function submitKioskInterview(
  intro: string,
  prepared?: KioskVisitContext | null,
  diagnostics: IntroDiagnostics = {},
) {
  const text = sanitizeSpokenIntro(intro)
  setVisitorIntro(text)
  const context = prepared ?? (await prepareKioskVisit())
  const persona = context ? { system_prompt: context.systemPrompt ?? '' } : await fetchPersonaForCurrentVisit()
  const centralOne = context ? { answers: context.stationOneAnswers } : peekStationOneForStation(3)
  const centralTwo = context ? context.stationTwo : peekStationTwoForStation(3)
  const built = buildKioskInterviewWithIntro(text, {
    stationOneAnswers: centralOne?.answers,
    stationTwo: centralTwo
      ? {
          answers: centralTwo.answers ?? {},
          lightningAnswers: centralTwo.lightningAnswers ?? {},
          height: centralTwo.height ?? 0.5,
        }
      : null,
    systemPrompt: persona?.system_prompt,
  })
  publish('station-3', 'intro_transcript', {
    chars: built.intro.length,
    preview: built.intro.slice(0, 140),
    source: built.transcriptSource,
    personaVisitId: context?.visitId ?? persona?.visit_id ?? null,
    personaPrompt: Boolean(persona?.system_prompt),
    ...diagnostics,
  })
  for (const url of ingestUrls()) {
    void postJson(url, built.payload)
  }
  return built
}
