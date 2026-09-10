import { lazy, Suspense, type ReactNode } from 'react'
import type { MirrorOverlayMode } from './MirrorCameraLayer'
import './MirrorJourney.css'

// MediaPipe is a heavy WebAssembly/browser dependency. Do not make the
// initial intake screen depend on it: Cog/WPE kiosks need to boot and accept
// the first answer before facial analysis is requested. The camera tree is
// loaded only when a scan phase actually needs it.
const MirrorCameraLayer = lazy(() =>
  import('./MirrorCameraLayer').then((module) => ({ default: module.MirrorCameraLayer })),
)

function CameraLoadingFallback() {
  return <div className="journey-camera-stage journey-camera-none" aria-hidden="true" />
}

export function MirrorStationShell({
  station,
  cameraMode,
  statusLeft,
  children,
}: {
  station: 'I' | 'II'
  cameraMode: MirrorOverlayMode
  statusLeft?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="journey-station" aria-label={`Station ${station}`}>
      <div className="journey-portrait">
        {cameraMode !== 'none' ? (
          <Suspense fallback={<CameraLoadingFallback />}>
            <MirrorCameraLayer mode={cameraMode} />
          </Suspense>
        ) : null}
        {statusLeft ? (
          <header className="journey-status">
            <span>{statusLeft}</span>
          </header>
        ) : null}
        <div className="journey-content">{children}</div>
      </div>
    </section>
  )
}
