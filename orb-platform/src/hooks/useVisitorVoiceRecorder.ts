import { useEffect } from 'react'
import { resetVisitorVoiceCapture, setVisitorVoiceCapture } from '../lib/visitorVoiceCapture'

function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined
  }
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
  return undefined
}

/** Starts a mic take while `active`, then stores the blob for Photobash. */
export function useVisitorVoiceRecorder(active: boolean) {
  useEffect(() => {
    if (!active) return
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return
    if (typeof MediaRecorder === 'undefined') return

    let cancelled = false
    let recorder: MediaRecorder | null = null
    let stream: MediaStream | null = null
    const chunks: Blob[] = []

    resetVisitorVoiceCapture()

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        const mimeType = pickRecorderMime()
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data)
        }
        recorder.onstop = () => {
          stream?.getTracks().forEach((track) => track.stop())
          stream = null
          if (chunks.length === 0) return
          setVisitorVoiceCapture(new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' }))
        }
        recorder.start()
      } catch {
        stream?.getTracks().forEach((track) => track.stop())
      }
    })()

    return () => {
      cancelled = true
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      else stream?.getTracks().forEach((track) => track.stop())
    }
  }, [active])
}
