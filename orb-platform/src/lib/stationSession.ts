import { resetVisitorFaceCapture } from './visitorFaceCapture'
import { resetVisitorProfile } from './visitorProfile'
import { resetStationTwoState } from './interviewStore'
import { publish } from './firehose'
import { publishKeyboardFocus } from './keyboardFocus'
import type { StationRoute } from './stationRoute'

export function stationFirehoseId(station: StationRoute): 'station-1' | 'station-2' | 'station-3' | null {
  if (station === 'station-1') return 'station-1'
  if (station === 'station-2') return 'station-2'
  if (station === 'mirror') return 'station-3'
  return null
}

/** Wipe this kiosk's in-progress answers and remount from question one.
 * Does not abort the room visit — a second finish is ignored if this
 * station already published interview_done. */
export function resetCurrentStationMemory(station: StationRoute): boolean {
  const id = stationFirehoseId(station)
  if (!id) return false
  if (station === 'station-1') {
    resetVisitorProfile()
    resetVisitorFaceCapture()
  } else if (station === 'station-2') {
    resetStationTwoState()
  } else {
    resetVisitorFaceCapture()
  }
  publish(id, 'station_reset', { station })
  // Hide the iPad immediately so it does not keep the previous YES/NO
  // (or slider) after this kiosk remounts from question one.
  publishKeyboardFocus(id, 'hidden')
  return true
}
