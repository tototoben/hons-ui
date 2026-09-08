import { publish } from './firehose'
import { buildKioskInterviewFromStores, type KioskInterviewPayload } from './kioskInterview'
import { setVisitorIntro } from './visitorIntro'

const ARS_DEFAULT = 'http://127.0.0.1:8190/api/kiosk-interview'

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
export function submitKioskInterview(intro: string) {
  const text = intro.trim()
  setVisitorIntro(text)
  const payload = buildKioskInterviewFromStores(text)
  publish('station-3', 'intro_transcript', {
    chars: text.length,
    preview: text.slice(0, 140),
  })
  for (const url of ingestUrls()) {
    void postJson(url, payload)
  }
  return payload
}
