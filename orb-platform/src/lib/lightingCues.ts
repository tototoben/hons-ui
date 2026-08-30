export const LIGHTING_CHANNEL = 'hons-lighting'

export type LightingCue =
  | 'station-1-intake'
  | 'station-1-scan'
  | 'station-1-complete'
  | 'station-2-intro'
  | 'station-2-question'
  | 'station-2-height'
  | 'station-2-complete'
  | 'station-3-intro'
  | 'station-3-prompt'
  | 'station-3-recording'
  | 'station-3-loading'
  | 'photobash-forming'
  | 'photobash-reveal'

export type LightingCueMessage = {
  type: 'lighting'
  cue: LightingCue
  station: string
  event: string
  ts: number
}

const PHASE_CUES: Record<string, LightingCue> = {
  'station-1:station_mounted': 'station-1-intake',
  'station-1:phase:intake': 'station-1-intake',
  'station-1:phase:analysis-intro': 'station-1-scan',
  'station-1:phase:scan-face': 'station-1-scan',
  'station-1:phase:scan-eyes': 'station-1-scan',
  'station-1:phase:scan-focus': 'station-1-scan',
  'station-1:phase:complete': 'station-1-complete',
  'station-1:phase:proceed': 'station-1-complete',
  'station-1:interview_done': 'station-1-complete',
  'station-2:station_mounted': 'station-2-intro',
  'station-2:phase:percentile': 'station-2-intro',
  'station-2:phase:companion-intro': 'station-2-intro',
  'station-2:phase:debra-brief': 'station-2-intro',
  'station-2:phase:question': 'station-2-question',
  'station-2:phase:height': 'station-2-height',
  'station-2:phase:lightning-intro': 'station-2-question',
  'station-2:phase:lightning': 'station-2-question',
  'station-2:phase:complete': 'station-2-complete',
  'station-2:interview_done': 'station-2-complete',
  'station-3:station_mounted': 'station-3-intro',
  'station-3:phase:intro': 'station-3-intro',
  'station-3:phase:prompt': 'station-3-prompt',
  'station-3:phase:recording': 'station-3-recording',
  'station-3:phase:loading': 'station-3-loading',
  'station-3:reveal_ready': 'photobash-reveal',
  'photobash:forming': 'photobash-forming',
  'photobash:reveal': 'photobash-reveal',
}

export function lightingCueFor(station: string, event: string): LightingCue | null {
  if (station === 'lighting') return null
  return PHASE_CUES[`${station}:${event}`] ?? null
}

let lightingChannel: BroadcastChannel | null = null

function lightingBus() {
  if (typeof BroadcastChannel === 'undefined') return null
  lightingChannel ??= new BroadcastChannel(LIGHTING_CHANNEL)
  return lightingChannel
}

export function postLightingCue(cue: LightingCue, station: string, event: string) {
  lightingBus()?.postMessage({
    type: 'lighting',
    cue,
    station,
    event,
    ts: Date.now(),
  } satisfies LightingCueMessage)
}

export function resetLightingChannel() {
  lightingChannel?.close()
  lightingChannel = null
}
