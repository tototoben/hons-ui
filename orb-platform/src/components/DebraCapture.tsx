import { applyDeviceQuality } from '../lib/deviceQuality'
import { applyStationVibe } from '../lib/stationVibe'
import { MirrorGuideOrb } from './MirrorGuideOrb'
import './DebraCapture.css'

applyDeviceQuality('full')
applyStationVibe('original')

/** Isolated WebGL Debra for recording a transparent loop. Not in the station switcher. */
export function DebraCapture() {
  return (
    <div className="debra-capture">
      <MirrorGuideOrb className="debra-capture-orb" live />
    </div>
  )
}
