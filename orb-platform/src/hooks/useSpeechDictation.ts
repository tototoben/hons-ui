import { useEffect, useRef, useState } from 'react'
import { webSpeechEnabled } from '../lib/transcribeIngest'

type SpeechRec = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecResultEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error?: string }) => void) | null
}

type SpeechRecResultEvent = {
  results: ArrayLike<{
    isFinal: boolean
    0?: { transcript?: string }
  }>
}

type SpeechRecCtor = new () => SpeechRec

function speechCtor(): SpeechRecCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecCtor
    webkitSpeechRecognition?: SpeechRecCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/**
 * Instant captions on Chrome/Chromium via the Web Speech API. cog/WPE has
 * no SpeechRecognition — Station III also runs useWhisperDictation.
 */
export function useSpeechDictation(active: boolean) {
  const [text, setText] = useState('')
  const textRef = useRef('')

  useEffect(() => {
    if (!active) return
    if (!webSpeechEnabled(window.location.search)) return
    const Ctor = speechCtor()
    if (!Ctor) return

    let stopped = false
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    textRef.current = ''
    setText('')

    rec.onresult = (event) => {
      let finalText = ''
      let interim = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        const piece = result?.[0]?.transcript ?? ''
        if (result?.isFinal) finalText += piece
        else interim += piece
      }
      const next = `${finalText}${interim}`.replace(/\s+/g, ' ').trim()
      textRef.current = next
      setText(next)
    }

    rec.onerror = () => {}

    rec.onend = () => {
      if (stopped) return
      try {
        rec.start()
      } catch {
        // Already started, or the browser refused a restart.
      }
    }

    try {
      rec.start()
    } catch {
      return
    }

    return () => {
      stopped = true
      rec.onend = null
      rec.onresult = null
      rec.onerror = null
      try {
        rec.stop()
      } catch {
        try {
          rec.abort()
        } catch {
          // Ignore browsers that throw if recognition never started.
        }
      }
    }
  }, [active])

  return text
}
