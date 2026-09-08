import { publish } from './firehose'
import { buildKioskInterviewFromVisit, type KioskInterviewPayload } from './kioskInterview'
import { setVisitorIntro } from './visitorIntro'

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

function postJson(url: string, payload: KioskInterviewPayload) {
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
  const payload = await buildKioskInterviewFromVisit(text)
  publish('station-3', 'intro_transcript', {
    chars: text.length,
    preview: text.slice(0, 140),
  })
  for (const url of ingestUrls()) {
    void postJson(url, payload)
  }
  return payload
}
