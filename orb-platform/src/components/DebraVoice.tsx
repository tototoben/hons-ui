import { useEffect, useRef } from 'react'
import { base } from '../config'

export type ThirdStationVoicePhase = 'intro' | 'prompt' | 'recording' | 'loading'

const THIRD_STATION_CLIPS: Partial<Record<ThirdStationVoicePhase, string>> = {
  intro: base('/audio/debra/06-now-is-your-chance.mp3'),
  prompt: base('/audio/debra/07-introduce-yourself-to-your-future-partner.mp3'),
}

export function thirdStationDebraClipFor(phase: ThirdStationVoicePhase) {
  return THIRD_STATION_CLIPS[phase] ?? null
}

export function DebraVoiceClip({ src }: { src: string | null }) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !src) return
    const activeAudio = audio

    let cancelled = false
    let awaitingGesture = false

    const removeGestureRetry = () => {
      if (!awaitingGesture) return
      window.removeEventListener('pointerdown', retryPlayback)
      window.removeEventListener('keydown', retryPlayback)
      window.removeEventListener('click', retryPlayback)
      awaitingGesture = false
    }

    const addGestureRetry = () => {
      if (awaitingGesture || cancelled) return
      awaitingGesture = true
      window.addEventListener('pointerdown', retryPlayback, { once: true })
      window.addEventListener('keydown', retryPlayback, { once: true })
      window.addEventListener('click', retryPlayback, { once: true })
    }

    function retryPlayback() {
      removeGestureRetry()
      void activeAudio.play().catch(addGestureRetry)
    }

    activeAudio.currentTime = 0
    void activeAudio.play().catch(addGestureRetry)

    return () => {
      cancelled = true
      removeGestureRetry()
      activeAudio.pause()
      activeAudio.currentTime = 0
    }
  }, [src])

  return src ? <audio ref={audioRef} src={src} preload="auto" aria-hidden="true" /> : null
}
