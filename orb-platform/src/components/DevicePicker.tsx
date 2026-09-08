import type { DeviceQuality } from '../lib/deviceQuality'
import {
  DEVICE_LOCK_LABELS,
  pickerChoices,
  type DeviceLock,
} from '../lib/deviceLock'
import './DevicePicker.css'

export function DevicePicker({
  quality,
  onLock,
}: {
  quality: DeviceQuality
  onLock: (lock: DeviceLock) => void
}) {
  return (
    <section className="device-picker" aria-label="Production lock">
      <div className="device-picker-copy">
        <p className="device-picker-kicker">Lock this machine</p>
        <p className="device-picker-hint">Alt+Shift+P to open · Alt+Shift+R to restart</p>
      </div>
      <ul className="device-picker-list">
        {pickerChoices(quality).map((lock) => (
          <li key={lock}>
            <button type="button" className="device-picker-choice" onClick={() => onLock(lock)}>
              {DEVICE_LOCK_LABELS[lock]}
            </button>
          </li>
        ))}
      </ul>
      {quality === 'full' ? (
        <div className="device-picker-sims">
          <a className="device-picker-sim" href="#/wall-sim">
            Wall sim
          </a>
          <a className="device-picker-sim" href="#/station-sim">
            Station sim
          </a>
        </div>
      ) : null}
    </section>
  )
}
