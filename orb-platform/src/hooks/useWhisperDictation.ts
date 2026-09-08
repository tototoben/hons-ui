import { useCallback, useEffect, useRef, useState } from 'react'
import { concatFloat32, downsampleTo16k, encodeWav } from '../lib/pcmWav'
import { transcribeWav } from '../lib/transcribeIngest'

const CHUNK_MS = 2500
const TARGET_RATE = 16000

type CaptureWindow = Window & {
  webkitAudioContext?: typeof AudioContext
}

/**
 * Record the Station III intro as 16 kHz WAV and send it to Studio Whisper.
 * Works in cog/WPE (no Web Speech API). Chrome can still show faster captions
 * from useSpeechDictation; this is the kiosk path.
 */
export function useWhisperDictation(active: boolean) {
  const [text, setText] = useState('')
  const textRef = useRef('')
  const chunksRef = useRef<Float32Array[]>([])
  const seqRef = useRef(0)
  const pendingRef = useRef<Promise<string> | null>(null)

  const post = useCallback(async (samples: Float32Array, seq: number) => {
    if (samples.length < TARGET_RATE * 0.4) return textRef.current
    const wav = encodeWav(samples, TARGET_RATE)
    const next = await transcribeWav(wav)
    if (seq !== seqRef.current) return textRef.current
    if (next) {
      textRef.current = next
      setText(next)
    }
    return textRef.current
  }, [])

  const flush = useCallback(async () => {
    seqRef.current += 1
    const seq = seqRef.current
    const samples = concatFloat32(chunksRef.current)
    const inFlight = pendingRef.current
    if (inFlight) {
      try {
        await inFlight
      } catch {
        // Keep going — we still POST the full buffer.
      }
    }
    const result = await post(samples, seq)
    return result
  }, [post])

  useEffect(() => {
    if (!active) return
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) return

    let stopped = false
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let processor: ScriptProcessorNode | null = null
    let timer = 0
    chunksRef.current = []
    textRef.current = ''
    setText('')
    seqRef.current += 1

    const tick = () => {
      if (stopped) return
      seqRef.current += 1
      const seq = seqRef.current
      const samples = concatFloat32(chunksRef.current)
      pendingRef.current = post(samples, seq)
    }

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        const Ctor = window.AudioContext ?? (window as CaptureWindow).webkitAudioContext
        if (!Ctor) return
        ctx = new Ctor()
        const source = ctx.createMediaStreamSource(stream)
        const mute = ctx.createGain()
        mute.gain.value = 0
        processor = ctx.createScriptProcessor(4096, 1, 1)
        processor.onaudioprocess = (event) => {
          if (stopped) return
          const input = event.inputBuffer.getChannelData(0)
          chunksRef.current.push(downsampleTo16k(new Float32Array(input), ctx?.sampleRate ?? 48000))
        }
        source.connect(processor)
        processor.connect(mute)
        mute.connect(ctx.destination)
        if (ctx.state === 'suspended') await ctx.resume()
        timer = window.setInterval(tick, CHUNK_MS)
      } catch {
        // Mic denied — Web Speech may still fill the caption on Chrome.
      }
    }

    void start()

    return () => {
      stopped = true
      window.clearInterval(timer)
      processor?.disconnect()
      stream?.getTracks().forEach((track) => track.stop())
      void ctx?.close()
    }
  }, [active, post])

  return { text, flush }
}
