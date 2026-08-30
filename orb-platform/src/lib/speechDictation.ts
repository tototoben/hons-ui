export type DictationAlternative = {
  transcript: string
}

export type DictationResult = {
  isFinal: boolean
  length?: number
  0?: DictationAlternative
  item?: (index: number) => DictationAlternative | null
}

function alternativeTranscript(result: DictationResult) {
  const alt = result[0] ?? result.item?.(0) ?? null
  return alt?.transcript ?? ''
}

export function joinUtterance(left: string, right: string) {
  const a = left.trim()
  const b = right.trim()
  if (!a) return b
  if (!b) return a
  return `${a} ${b}`
}

export function transcriptFromRecognitionResults(results: ArrayLike<DictationResult>): string {
  let finals = ''
  let interim = ''
  for (let i = 0; i < results.length; i += 1) {
    const result = results[i]
    const text = alternativeTranscript(result)
    if (result.isFinal) finals = joinUtterance(finals, text)
    else interim = joinUtterance(interim, text)
  }
  return joinUtterance(finals, interim)
}

export function normalizeTranscript(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 600)
}

export function dictationCaption(
  transcript: string,
  error: string | null,
  hasApi: boolean,
) {
  const spoken = transcript.trim()
  if (spoken) return spoken
  if (!hasApi || error === 'unavailable') return 'Open this in Chrome to see your words'
  if (error === 'not-allowed') return 'Allow the microphone'
  if (error === 'network') return 'Dictation needs the internet'
  if (error === 'audio-capture') return 'Mic is busy'
  if (error === 'service-not-allowed') return 'Dictation is blocked'
  if (error === 'language-not-supported') return 'Dictation language is not available'
  return 'Listening...'
}

type RecognitionCtor = new () => {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onresult: ((event: { results: ArrayLike<DictationResult> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

export function speechRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const speechWindow = window as Window & {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}
