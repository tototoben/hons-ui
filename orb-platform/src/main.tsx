import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyDeviceQuality } from './lib/deviceQuality'
import { applyStationVibe, getStationVibe } from './lib/stationVibe'

applyDeviceQuality()
applyStationVibe(getStationVibe())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
