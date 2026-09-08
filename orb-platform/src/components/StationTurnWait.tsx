import { useEffect } from 'react'
import { publish } from '../lib/firehose'
import { publishKeyboardFocus } from '../lib/keyboardFocus'
import { MirrorStationShell } from './MirrorStationShell'
import './ThirdStation.css'

type StationTurnWaitProps = {
  station: 'II' | 'III'
  stationId: 'station-2' | 'station-3'
}

/** Blank attract screen until central routes a visitor to this station. */
export function StationTurnWait({ station, stationId }: StationTurnWaitProps) {
  useEffect(() => {
    publishKeyboardFocus(stationId, 'hidden')
    publish(stationId, 'station_waiting', {})
  }, [stationId])

  if (station === 'II') {
    return (
      <MirrorStationShell station="II" cameraMode="none">
        <div className="station-turn-wait" aria-hidden="true" />
      </MirrorStationShell>
    )
  }

  return (
    <section className="third-station third-station-wait" aria-label="Mirror station">
      <div className="mirror-frame" aria-hidden="true" />
    </section>
  )
}
