import { useEffect, useRef } from 'react'
import { loadStationTwoState } from '../lib/interviewStore'
import { buildPhotobashScript } from '../lib/photobashScript'
import { cancelSpeech, playAudioUrl, speakText } from '../lib/photobashSpeech'
import { getVisitorProfile } from '../lib/visitorProfile'
import { getVisitorVoiceUrl } from '../lib/visitorVoiceCapture'

export function PhotobashVoice({
  cycleKey,
  loadingProgress,
}: {
  cycleKey: number
  loadingProgress: number
}) {
  const progressRef = useRef(loadingProgress)
  progressRef.current = loadingProgress

  useEffect(() => {
    let cancelled = false
    const waitForCollage = () =>
      new Promise<void>((resolve) => {
        const tick = () => {
          if (cancelled || progressRef.current >= 1) {
            resolve()
            return
          }
          window.setTimeout(tick, 200)
        }
        tick()
      })

    const run = async () => {
      cancelSpeech()
      const script = buildPhotobashScript({
        profile: getVisitorProfile(),
        stationTwo: loadStationTwoState(),
        hasVoice: Boolean(getVisitorVoiceUrl()),
      })
      for (const line of script.opening) {
        if (cancelled) return
        await speakText(line)
      }
      await waitForCollage()
      for (const line of [...script.middle, ...script.closing]) {
        if (cancelled) return
        await speakText(line)
      }
      if (!cancelled) await playAudioUrl(getVisitorVoiceUrl())
    }

    void run()
    return () => {
      cancelled = true
      cancelSpeech()
    }
  }, [cycleKey])

  return null
}
