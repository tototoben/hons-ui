const STT_DEFAULT = 'http://127.0.0.1:8190/api/transcribe'

/** Chrome Web Speech is on by default. `?speech=0` forces the kiosk Whisper path. */
export function webSpeechEnabled(search = ''): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const speech = params.get('speech')
  return speech !== '0' && speech !== 'false'
}

export function transcribeUrls(search = '', hostname = ''): string[] {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const explicit = params.get('stt')
  if (explicit === '0' || explicit === 'false') return []
  if (explicit) return [explicit]
  const urls = ['/orb/__hons/transcribe', '/__hons/transcribe']
  if (/^(localhost|127\.0\.0\.1|\[::1\])/i.test(hostname)) urls.push(STT_DEFAULT)
  return urls
}

export async function transcribeWav(blob: Blob): Promise<string> {
  if (typeof window === 'undefined') return ''
  const urls = transcribeUrls(window.location.search, window.location.hostname)
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: blob,
      })
      if (!res.ok) continue
      const payload = (await res.json()) as { text?: string }
      if (typeof payload.text === 'string' && payload.text.trim()) return payload.text.trim()
    } catch {
      // Try the next ingest URL — Vite proxy or the Studio process may be down.
    }
  }
  return ''
}
