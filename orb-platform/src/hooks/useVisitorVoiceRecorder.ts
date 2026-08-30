import { useCallback, useEffect, useRef, useState } from 'react'
import {
  dictationCaption,
  joinUtterance,
  normalizeTranscript,
  speechRecognitionCtor,
  transcriptFromRecognitionResults,
} from '../lib/speechDictation'
import {
  resetVisitorVoiceCapture,
  setVisitorVoiceTranscript,
} from '../lib/visitorVoiceCapture'

type Recognition = ReturnType<NonNullable<ReturnType<typeof speechRecognitionCtor>>>

/** Chrome dictation only. Holding getUserMedia at the same time aborts captions. */
export function useVisitorVoiceRecorder(active: boolean) {
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<Recognition | null>(null)
  const hasApi = typeof window !== 'undefined' && Boolean(speechRecognitionCtor())

  useEffect(() => {
    if (!active) return
    if (typeof navigator === 'undefined') return

    let cancelled = false
    let committed = ''
    let latest = ''
    let restartTimer = 0
    const Ctor = speechRecognitionCtor()

    resetVisitorVoiceCapture()
    setTranscript('')
    setError(Ctor ? null : 'unavailable')

    const persistTranscript = () => {
      const text = normalizeTranscript(latest)
      setVisitorVoiceTranscript(text)
      if (!cancelled) setTranscript(text)
    }

    const startDictation = () => {
      if (!Ctor || cancelled) return
      const recognition = new Ctor()
      recognitionRef.current = recognition
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      recognition.lang = 'en-US'
      recognition.onresult = (event) => {
        const current = transcriptFromRecognitionResults(event.results)
        latest = joinUtterance(committed, current)
        setError(null)
        setTranscript(latest)
      }
      recognition.onerror = (event) => {
        const code = event.error ?? ''
        if (code === 'no-speech' || code === 'aborted') return
        if (!cancelled) setError(code)
      }
      recognition.onend = () => {
        committed = latest
        if (cancelled) {
          persistTranscript()
          return
        }
        restartTimer = window.setTimeout(() => {
          if (cancelled) return
          try {
            recognition.start()
          } catch {
            persistTranscript()
          }
        }, 160)
      }
      try {
        recognition.start()
      } catch {
        recognitionRef.current = null
        if (!cancelled) setError('audio-capture')
      }
    }

    void (async () => {
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const permission = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          })
          permission.getTracks().forEach((track) => track.stop())
        } catch (err) {
          const name = err instanceof DOMException ? err.name : ''
          if (!cancelled && name === 'NotAllowedError') setError('not-allowed')
          if (!cancelled && name === 'NotReadableError') setError('audio-capture')
        }
      }
      if (cancelled) return
      startDictation()
    })()

    return () => {
      cancelled = true
      window.clearTimeout(restartTimer)
      persistTranscript()
      const recognition = recognitionRef.current
      recognitionRef.current = null
      if (recognition) {
        try {
          recognition.stop()
        } catch {
          recognition.abort()
        }
      }
    }
  }, [active])

  const arm = useCallback(() => {
    try {
      recognitionRef.current?.start()
    } catch {
      // already started
    }
  }, [])

  return {
    transcript,
    caption: dictationCaption(transcript, error, hasApi),
    arm,
  }
}
