import { useEffect, useRef, useState, type RefObject } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { PARALLAX } from '../config'
import {
  detectIntervalMs,
  getDeviceQuality,
  mirrorCameraConstraints,
  mirrorCameraFallbackConstraints,
} from '../lib/deviceQuality'
import {
  deriveFaceAppearance,
  readVideoFrame,
  sampleFaceColorRegions,
  smoothAppearance,
  type FaceAppearance,
} from '../lib/mirrorFaceAppearance'
import {
  deriveMirrorFaceSignals,
  NEUTRAL_MIRROR_FACE_SIGNALS,
  type MirrorFaceSignals,
} from '../lib/mirrorFaceSignals'
import type { NormalizedLandmark } from '../lib/mirrorLandmarks'
import { readSelectedCameraId, writeSelectedCameraId } from '../lib/mirrorCameraDevice'
import { acquireCameraStream, isSharedCameraStream } from '../lib/sharedCameraStream'
import { postWallDiagnostic } from '../lib/wallDiagnostics'

const MIN_APPEARANCE_LANDMARKS = 400

export type MirrorCameraStatus =
  | 'starting'
  | 'active'
  | 'denied'
  | 'unavailable'

export type MirrorCameraDeviceOption = { deviceId: string; label: string }

/** One MediaPipe detect result. Lives in a ref, never in React state —
 * at 8–15 Hz, re-rendering the camera tree per tick costs far more than
 * the canvas / CSS-variable writes it would drive. */
export type MirrorCameraSample = {
  landmarks: NormalizedLandmark[]
  signals: MirrorFaceSignals
  appearance: FaceAppearance | null
}

const EMPTY_SAMPLE: MirrorCameraSample = {
  landmarks: [],
  signals: NEUTRAL_MIRROR_FACE_SIGNALS,
  appearance: null,
}

export type MirrorCameraHandle = {
  videoRef: RefObject<HTMLVideoElement | null>
  status: MirrorCameraStatus
  /** The live sample. Consumers that need per-tick values (canvas, pose
   * custom properties, appearance readout) read this, not the snapshot
   * fields below. */
  sampleRef: RefObject<MirrorCameraSample>
  /** Snapshots of `sampleRef.current` at the time of the render that
   * produced this handle — stale between renders by design. */
  landmarks: NormalizedLandmark[]
  signals: MirrorFaceSignals
  appearance: FaceAppearance | null
  /** Enumerated video inputs — only has real labels once permission has
   * been granted at least once (browser privacy rule, not a bug here). */
  devices: MirrorCameraDeviceOption[]
  /** What the operator explicitly asked for (persisted); null means
   * "browser default" (facingMode: 'user'). */
  selectedDeviceId: string | null
  /** What's actually running right now, read back from the live track —
   * lets the picker show the right entry even before anyone has chosen
   * one explicitly. */
  activeDeviceId: string | null
  selectDevice: (deviceId: string | null) => void
}

export function useMirrorCamera({
  tracking = true,
}: {
  tracking?: boolean
} = {}): MirrorCameraHandle {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<MirrorCameraStatus>('starting')
  const sampleRef = useRef<MirrorCameraSample>(EMPTY_SAMPLE)
  const appearanceRef = useRef<FaceAppearance | null>(null)
  const [devices, setDevices] = useState<MirrorCameraDeviceOption[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(
    () => readSelectedCameraId(),
  )
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null)

  const selectDevice = (deviceId: string | null) => {
    writeSelectedCameraId(deviceId)
    setSelectedDeviceId(deviceId)
  }

  useEffect(() => {
    // The camera is first requested when a scan phase needs it, not on
    // mount. Once granted, the stream is kept for the page's lifetime and
    // reused (sharedCameraStream.ts) so later visits don't re-prompt.
    if (!tracking) {
      setStatus('starting')
      return
    }

    let cancelled = false
    let stream: MediaStream | null = null
    let permissionTimer: ReturnType<typeof setTimeout> | undefined
    let permissionTimedOut = false
    // Recovery from a camera that vanishes mid-session (2026-09-12: the
    // Brio re-enumerated on USB and the kiosk kept a dead stream for three
    // hours, silently). See onTrackEnded / scheduleRetry below.
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let retryAttempt = 0
    const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000]

    // The track whose 'ended' event we listen to; the shared stream outlives
    // this mount, so the listener has to come off in cleanup.
    let watchedTrack: MediaStreamTrack | null = null

    const releaseStream = () => {
      watchedTrack?.removeEventListener?.('ended', onTrackEnded)
      watchedTrack = null
      // Never stop the page-wide camera stream (it carries the next scan
      // without a new permission prompt) or the parent's embedded stream.
      // A dead shared stream is reopened by acquireCameraStream on retry.
      if (
        stream &&
        !isSharedCameraStream(stream) &&
        stream !== (window.parent as any).__mirrorCameraStream
      ) {
        stream.getTracks().forEach((track) => track.stop())
      }
      stream = null
    }

    const scheduleRetry = (reason: string) => {
      if (cancelled || retryTimer) return
      const delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)]
      retryAttempt += 1
      postWallDiagnostic('camera', { event: 'reacquire_scheduled', reason, attempt: retryAttempt, delay_ms: delay })
      retryTimer = setTimeout(() => {
        retryTimer = undefined
        if (!cancelled) void start()
      }, delay)
    }

    const onTrackEnded = () => {
      if (cancelled) return
      // The device went away underneath us. Drop the dead stream, show the
      // visitor the 'starting' state rather than a frozen frame, and try
      // again -- a re-enumerating device takes a moment to come back.
      releaseStream()
      const video = videoRef.current
      if (video) video.srcObject = null
      setStatus('starting')
      postWallDiagnostic('camera', { event: 'track_ended' })
      scheduleRetry('track_ended')
    }

    const onDeviceChange = () => {
      // A device (re)appeared: if a retry is pending, take it now.
      if (cancelled || !retryTimer) return
      clearTimeout(retryTimer)
      retryTimer = undefined
      void start()
    }
    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange)

    // getUserMedia with the pinned device first; if that device no longer
    // exists (it was re-enumerated with a new id, or unplugged), fall back
    // to the plain constraints rather than failing for the rest of the day.
    // Both paths go through the page-wide shared stream (sharedCameraStream.ts)
    // so permission is asked once per page load.
    // WebKit's OverconstrainedError is not always a DOMException, so match
    // on the name alone.
    const errorName = (error: unknown) =>
      typeof error === 'object' && error !== null && 'name' in error
        ? String((error as { name: unknown }).name)
        : ''

    // The preferred constraints rule out modes some cameras lack; relax
    // them rather than leave such a camera dark.
    const openWithConstraints = async (deviceId: string | null) => {
      try {
        return await acquireCameraStream(mirrorCameraConstraints(), deviceId)
      } catch (error) {
        if (errorName(error) !== 'OverconstrainedError') throw error
        postWallDiagnostic('camera', { event: 'constraints_relaxed' })
        return acquireCameraStream(mirrorCameraFallbackConstraints(), deviceId)
      }
    }

    const openStream = async (): Promise<MediaStream> => {
      if (!selectedDeviceId) return openWithConstraints(null)
      try {
        return await openWithConstraints(selectedDeviceId)
      } catch (error) {
        const name = errorName(error)
        if (name !== 'OverconstrainedError' && name !== 'NotFoundError') throw error
        postWallDiagnostic('camera', { event: 'pinned_device_missing', fallback: true })
        return openWithConstraints(null)
      }
    }

    const isEmbedded =
      new URLSearchParams(window.location.search).get('embedded') === '1'

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setStatus('unavailable')
        return
      }

      // When embedded, wait for the parent page to have a camera stream
      // ready. The parent calls getUserMedia on a user gesture (which
      // browsers require), then exposes the stream on window.__mirrorCameraStream.
      // We poll for it since the iframe may load before or after the parent
      // gets the stream.
      if (isEmbedded) {
        const parentStream = await new Promise<MediaStream | null>((resolve) => {
          if (window.parent === window) return resolve(null)
          const check = () => {
            const s = (window.parent as any).__mirrorCameraStream as
              | MediaStream
              | undefined
            if (s && s.active) return resolve(s)
            if (cancelled) return resolve(null)
            setTimeout(check, 200)
          }
          check()
          setTimeout(() => resolve(null), 30_000)
        })
        if (!parentStream || cancelled) {
          if (!cancelled) setStatus('unavailable')
          return
        }

        stream = parentStream
        const video = videoRef.current
        if (!video) {
          setStatus('unavailable')
          return
        }
        video.srcObject = stream
        try {
          await video.play()
        } catch {
          setStatus('unavailable')
          return
        }
        if (!cancelled) setStatus('active')
        return
      }

      try {
        permissionTimer = setTimeout(() => {
          permissionTimedOut = true
          if (!cancelled) setStatus('unavailable')
        }, 15_000)
        // Shared for the page's lifetime, so a late or cancelled mount leaves
        // it running for the next scan instead of stopping it and prompting
        // for permission again.
        stream = await openStream()
        clearTimeout(permissionTimer)
        permissionTimer = undefined
        if (permissionTimedOut || cancelled) {
          stream = null
          return
        }

        const video = videoRef.current
        if (!video) throw new Error('Camera view is unavailable')
        video.srcObject = stream
        await video.play()

        const activeTrack = stream.getVideoTracks?.()[0]
        if (!cancelled) {
          setActiveDeviceId(activeTrack?.getSettings?.().deviceId ?? null)
        }
        // The one signal a vanished camera gives us. Without this the hook
        // sat at status 'active' over a frozen frame for hours.
        activeTrack?.addEventListener?.('ended', onTrackEnded)
        watchedTrack = activeTrack ?? null
        if (retryAttempt > 0) {
          postWallDiagnostic('camera', { event: 'reacquired', attempts: retryAttempt })
          retryAttempt = 0
        }

        // Device labels are only populated once permission has been
        // granted at least once — this is the earliest point that's true,
        // so the picker's option list only really fills in after a first
        // successful connection. A failure here shouldn't block the
        // camera itself; it's only a nice-to-have for the picker UI.
        if (navigator.mediaDevices.enumerateDevices) {
          try {
            const list = await navigator.mediaDevices.enumerateDevices()
            if (!cancelled) {
              setDevices(
                list
                  .filter((entry) => entry.kind === 'videoinput')
                  .map((entry, index) => ({
                    deviceId: entry.deviceId,
                    label: entry.label || `Camera ${index + 1}`,
                  })),
              )
            }
          } catch {
            // Ignored — see comment above.
          }
        }

        if (!cancelled) setStatus('active')
      } catch (error) {
        clearTimeout(permissionTimer)
        permissionTimer = undefined
        if (cancelled) return
        console.error('[useMirrorCamera] getUserMedia failed:', error)
        const denied = error instanceof DOMException && error.name === 'NotAllowedError'
        setStatus(denied ? 'denied' : 'unavailable')
        // A denial is final; anything else (device busy, not found, a
        // re-enumeration still in progress) is worth another try.
        if (!denied) {
          postWallDiagnostic('camera', {
            event: 'acquire_failed',
            name: error instanceof DOMException ? error.name : 'Error',
          })
          scheduleRetry('acquire_failed')
        }
      }
    }

    void start()

    return () => {
      cancelled = true
      clearTimeout(permissionTimer)
      clearTimeout(retryTimer)
      navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange)
      releaseStream()
      const video = videoRef.current
      if (video) {
        video.pause()
        video.srcObject = null
      }
    }
  }, [selectedDeviceId, tracking])

  useEffect(() => {
    if (!tracking || status !== 'active') {
      if (!tracking) {
        sampleRef.current = EMPTY_SAMPLE
        appearanceRef.current = null
      }
      return
    }

    let cancelled = false
    let landmarker: FaceLandmarker | null = null
    let raf = 0
    let lastDetection = 0
    let missedFaces = 0
    const interval = detectIntervalMs()
    const quality = getDeviceQuality()

    const detect = (now: number) => {
      if (cancelled) return
      const video = videoRef.current
      if (
        video &&
        landmarker &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        now - lastDetection >= interval
      ) {
        lastDetection = now
        const result = landmarker.detectForVideo(video, now)
        const detectedLandmarks =
          (result.faceLandmarks?.[0] as NormalizedLandmark[] | undefined) ?? []
        const nextSignals =
          detectedLandmarks.length > 0
            ? deriveMirrorFaceSignals(
                result.faceBlendshapes?.[0]?.categories,
                result.facialTransformationMatrixes?.[0]?.data,
              )
            : NEUTRAL_MIRROR_FACE_SIGNALS
        let nextAppearance = sampleRef.current.appearance
        if (detectedLandmarks.length >= MIN_APPEARANCE_LANDMARKS) {
          missedFaces = 0
          const derived = appearanceFromLandmarks(video, detectedLandmarks)
          const smoothed = derived
            ? smoothAppearance(appearanceRef.current, derived)
            : null
          appearanceRef.current = smoothed
          nextAppearance = smoothed
        } else {
          missedFaces += 1
          if (missedFaces > 8) {
            appearanceRef.current = null
            nextAppearance = null
          }
        }
        sampleRef.current = {
          landmarks: detectedLandmarks,
          signals: nextSignals,
          appearance: nextAppearance,
        }
      }
      raf = requestAnimationFrame(detect)
    }

    const createLandmarker = async () => {
      const vision = await FilesetResolver.forVisionTasks(PARALLAX.wasmBase)
      const options = {
        runningMode: 'VIDEO' as const,
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      }
      if (quality === 'kiosk') {
        return FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: PARALLAX.modelUrl, delegate: 'CPU' },
          ...options,
        })
      }
      try {
        return await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: PARALLAX.modelUrl, delegate: 'GPU' },
          ...options,
        })
      } catch {
        return FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: PARALLAX.modelUrl, delegate: 'CPU' },
          ...options,
        })
      }
    }

    void createLandmarker()
      .then((created) => {
        if (cancelled) {
          created.close()
          return
        }
        landmarker = created
        raf = requestAnimationFrame(detect)
      })
      .catch(() => {
        landmarker = null
      })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      landmarker?.close()
    }
  }, [status, tracking])

  return {
    videoRef,
    status,
    sampleRef,
    get landmarks() {
      return sampleRef.current.landmarks
    },
    get signals() {
      return sampleRef.current.signals
    },
    get appearance() {
      return sampleRef.current.appearance
    },
    devices,
    selectedDeviceId,
    activeDeviceId,
    selectDevice,
  }
}

function appearanceFromLandmarks(
  video: HTMLVideoElement,
  landmarks: NormalizedLandmark[],
) {
  const frame = {
    width: video.videoWidth || 1080,
    height: video.videoHeight || 1920,
  }
  const image = readVideoFrame(video)
  const samples = image
    ? sampleFaceColorRegions(image, landmarks)
    : { hair: null, eyes: null }

  return deriveFaceAppearance({
    ...samples,
    landmarks,
    frame,
  })
}
