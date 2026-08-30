let cachedVoice: SpeechSynthesisVoice | null | undefined

export function resetSpeechVoiceCache() {
  cachedVoice = undefined
}

export function pickFemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null
  const english = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'))
  const pool = english.length > 0 ? english : voices
  const ranked = pool
    .map((voice) => ({ voice, score: femaleVoiceScore(voice) }))
    .sort((a, b) => b.score - a.score)
  const best = ranked[0]
  if (!best || best.score < 0) return pool[0] ?? null
  return best.voice
}

function femaleVoiceScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase()
  if (/\bmale\b|david|mark|daniel|george|fred|\balex\b|ravi|thomas|guy\b/.test(name)) return -1
  if (/female/.test(name)) return 5
  if (
    /zira|samantha|victoria|karen|moira|tessa|fiona|jenny|aria|sonia|libby|susan|hazel|linda|heather|sara\b|catherine|martha|zira desktop/.test(
      name,
    )
  ) {
    return 4
  }
  if (voice.lang.toLowerCase().startsWith('en')) return 1
  return 0
}

export function cancelSpeech(speech: SpeechSynthesis | undefined = defaultSpeech()) {
  speech?.cancel()
}

export function speakText(
  text: string,
  speech: SpeechSynthesis | undefined = defaultSpeech(),
): Promise<void> {
  const line = text.trim()
  if (!line) return Promise.resolve()
  if (!speech || typeof SpeechSynthesisUtterance === 'undefined') return Promise.resolve()

  return resolveFemaleVoice(speech).then((voice) => {
    return new Promise((resolve) => {
      const utter = new SpeechSynthesisUtterance(line)
      utter.rate = 0.92
      utter.pitch = voice ? 1.05 : 1.2
      if (voice) utter.voice = voice
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        resolve()
      }
      utter.onend = finish
      utter.onerror = finish
      speech.speak(utter)
      window.setTimeout(finish, Math.min(20_000, 900 + line.length * 70))
    })
  })
}

export function playAudioUrl(url: string | null): Promise<void> {
  if (!url) return Promise.resolve()
  return new Promise((resolve) => {
    const audio = new Audio(url)
    const finish = () => resolve()
    audio.addEventListener('ended', finish, { once: true })
    audio.addEventListener('error', finish, { once: true })
    void audio.play().catch(finish)
  })
}

function defaultSpeech() {
  return typeof window === 'undefined' ? undefined : window.speechSynthesis
}

function resolveFemaleVoice(speech: SpeechSynthesis): Promise<SpeechSynthesisVoice | null> {
  if (cachedVoice !== undefined) return Promise.resolve(cachedVoice)
  const existing = speech.getVoices()
  if (existing.length > 0) {
    cachedVoice = pickFemaleVoice(existing)
    return Promise.resolve(cachedVoice)
  }
  return new Promise((resolve) => {
    const finish = () => {
      cachedVoice = pickFemaleVoice(speech.getVoices())
      resolve(cachedVoice)
    }
    speech.addEventListener('voiceschanged', finish, { once: true })
    window.setTimeout(finish, 400)
  })
}
