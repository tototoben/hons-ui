import { publish } from './firehose'
import {
  fetchPersonaForCurrentVisit,
  peekStationOneForStation,
  peekStationTwoForStation,
  refreshVisitCache,
} from './visitCentral'
import { setVisitorIntro } from './visitorIntro'
import { buildKioskInterviewWithIntro } from './syntheticTranscript'

const ARS_DEFAULT = 'http://127.0.0.1:8190/api/kiosk-interview'
/** Ignore whisper noise on silence — typed Station I/II answers still win. */
const MIN_SPOKEN_INTRO_CHARS = 12
const HALLUCINATION_RE =
  /\b(thanks?\s+for\s+watching|please\s+subscribe|subtitles?\s+by)\b/i

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

/** Persist the spoken intro and hand Station I/II + III to ARS. */
export async function submitKioskInterview(intro: string) {
  const text = sanitizeSpokenIntro(intro)
  setVisitorIntro(text)
  await refreshVisitCache(true)
  const persona = await fetchPersonaForCurrentVisit()
  const centralOne = peekStationOneForStation(3)
  const centralTwo = peekStationTwoForStation(3)
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
    personaVisitId: persona?.visit_id ?? null,
    personaPrompt: Boolean(persona?.system_prompt),
  })
  for (const url of ingestUrls()) {
    void postJson(url, built.payload)
  }
  return built
}
