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
      <p className="device-picker-kicker">Lock this machine</p>
      <ul className="device-picker-list">
        {pickerChoices(quality).map((lock) => (
          <li key={lock}>
            <button type="button" className="device-picker-choice" onClick={() => onLock(lock)}>
              {DEVICE_LOCK_LABELS[lock]}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
