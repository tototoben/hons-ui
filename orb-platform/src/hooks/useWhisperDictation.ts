import { useCallback, useEffect, useRef, useState } from 'react'
import { concatFloat32, downsampleTo16k, encodeWav, pcmRms } from '../lib/pcmWav'
import { transcribeWav } from '../lib/transcribeIngest'

const CHUNK_MS = 500
const TARGET_RATE = 16000
const MIN_SECONDS = 0.6
const MIN_RMS = 0.012

const MIC: MediaStreamConstraints = {
  audio: {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false,
}

type CaptureWindow = Window & {
  webkitAudioContext?: typeof AudioContext
}

/**
 * One mic stream → 16 kHz WAV → Studio Whisper. Polls every 500ms but only
 * starts a new clip after the previous one returns, so captions stay live
 * without piling up requests.
 */
export function useWhisperDictation(active: boolean) {
  const [text, setText] = useState('')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const textRef = useRef('')
  const chunksRef = useRef<Float32Array[]>([])
  const seqRef = useRef(0)
  const pendingRef = useRef<Promise<string> | null>(null)
  const busyRef = useRef(false)

  const post = useCallback(async (samples: Float32Array, seq: number, force: boolean) => {
    if (!force) {
      if (samples.length < TARGET_RATE * MIN_SECONDS) return textRef.current
      if (pcmRms(samples) < MIN_RMS) return textRef.current
    } else if (samples.length < TARGET_RATE * 0.4) {
      return textRef.current
    }
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
    const inFlight = pendingRef.current
    if (inFlight) {
      try {
        await inFlight
      } catch {
        // Still POST the full buffer.
      }
    }
    return post(concatFloat32(chunksRef.current), seq, true)
  }, [post])

  useEffect(() => {
    if (!active) {
      setStream(null)
      return
    }
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) return

    let stopped = false
    let media: MediaStream | null = null
    let ctx: AudioContext | null = null
    let processor: ScriptProcessorNode | null = null
    let timer = 0
    let queued = false
    chunksRef.current = []
    textRef.current = ''
    setText('')
    seqRef.current += 1

    const send = async (force = false) => {
      if (stopped) return
      if (busyRef.current) {
        queued = true
        return
      }
      const samples = concatFloat32(chunksRef.current)
      busyRef.current = true
      queued = false
      seqRef.current += 1
      const seq = seqRef.current
      const job = post(samples, seq, force)
      pendingRef.current = job
      try {
        await job
      } finally {
        busyRef.current = false
        if (!stopped && queued) void send(false)
      }
    }

    const start = async () => {
      try {
        media = await navigator.mediaDevices.getUserMedia(MIC)
        if (stopped) {
          media.getTracks().forEach((track) => track.stop())
          return
        }
        setStream(media)
        const Ctor = window.AudioContext ?? (window as CaptureWindow).webkitAudioContext
        if (!Ctor) return
        ctx = new Ctor()
        const source = ctx.createMediaStreamSource(media)
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
        timer = window.setInterval(() => {
          void send(false)
        }, CHUNK_MS)
      } catch {
        setStream(null)
      }
    }

    void start()

    return () => {
      stopped = true
      window.clearInterval(timer)
      processor?.disconnect()
      media?.getTracks().forEach((track) => track.stop())
      setStream(null)
      void ctx?.close()
    }
  }, [active, post])

  return { text, flush, stream }
}
