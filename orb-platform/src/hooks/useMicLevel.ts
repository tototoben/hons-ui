import { useEffect, useRef, useState } from 'react'
import { AUDIO } from '../config'
import { audioLevels } from '../lib/audioLevels'

export const MIC_BAR_COUNT = 24

const SMOOTH = 0.45

function idleBars() {
  const half = MIC_BAR_COUNT / 2
  return Array.from({ length: MIC_BAR_COUNT }, (_, i) => {
    const d = Math.abs(i + 0.5 - half) / half
    return 0.1 + 0.28 * (1 - d * d)
  })
}

/**
 * Mic-only analyser for Station III's recording viewfinder. Pass the Whisper
 * capture stream so we don't open a second getUserMedia (that starved the
 * transcriber).
 */
export function useMicLevel(active: boolean, sharedStream?: MediaStream | null) {
  const [bars, setBars] = useState<number[]>(idleBars)
  const barsRef = useRef(bars)
  barsRef.current = bars

  useEffect(() => {
    if (!active) {
      setBars(idleBars())
      audioLevels.active = false
      audioLevels.level = 0
      return
    }
    if (sharedStream === null) return

    let cancelled = false
    let owned: MediaStream | null = null
    let ctx: AudioContext | null = null
    let raf = 0
    const analyserRef: { current: AnalyserNode | null } = { current: null }
    const freqRef: { current: Uint8Array | null } = { current: null }
    const timeRef: { current: Uint8Array | null } = { current: null }

    const tick = () => {
      const analyser = analyserRef.current
      const freq = freqRef.current
      const time = timeRef.current
      if (analyser && freq && time) {
        analyser.getByteFrequencyData(freq as Uint8Array<ArrayBuffer>)
        analyser.getByteTimeDomainData(time as Uint8Array<ArrayBuffer>)

        let sum = 0
        for (let i = 0; i < time.length; i++) {
          const value = (time[i]! - 128) / 128
          sum += value * value
        }
        const rms = Math.min(1, Math.sqrt(sum / time.length) * AUDIO.sensitivity * 2.2)
        audioLevels.level += (rms - audioLevels.level) * (1 - AUDIO.smoothing)
        audioLevels.active = true

        const next = barsRef.current.slice()
        const half = MIC_BAR_COUNT / 2
        const usable = Math.max(8, Math.floor(freq.length * 0.42))
        for (let i = 0; i < half; i++) {
          const bin = Math.min(usable - 1, Math.floor((i / half) ** 1.35 * usable))
          const raw = (freq[bin] ?? 0) / 255
          const value = Math.min(1, 0.08 + raw * AUDIO.sensitivity)
          const left = half - 1 - i
          const right = half + i
          next[left] = next[left]! + (value - next[left]!) * SMOOTH
          next[right] = next[right]! + (value - next[right]!) * SMOOTH
        }
        setBars(next)
      }
      raf = requestAnimationFrame(tick)
    }

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia && !sharedStream) return
      try {
        const stream = sharedStream ?? (await navigator.mediaDevices.getUserMedia({ audio: true, video: false }))
        if (!sharedStream) owned = stream
        if (cancelled) {
          owned?.getTracks().forEach((track) => track.stop())
          return
        }
        ctx = new AudioContext()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = AUDIO.fftSize
        analyser.smoothingTimeConstant = 0.72
        source.connect(analyser)
        analyserRef.current = analyser
        freqRef.current = new Uint8Array(analyser.frequencyBinCount)
        timeRef.current = new Uint8Array(analyser.fftSize)
        audioLevels.active = true
        if (ctx.state === 'suspended') await ctx.resume()
        raf = requestAnimationFrame(tick)
      } catch {
        audioLevels.active = false
      }
    }

    void start()

    return () => {
      cancelled = true
      if (raf) cancelAnimationFrame(raf)
      owned?.getTracks().forEach((track) => track.stop())
      void ctx?.close()
      audioLevels.active = false
      audioLevels.level = 0
    }
  }, [active, sharedStream])

  return bars
}
