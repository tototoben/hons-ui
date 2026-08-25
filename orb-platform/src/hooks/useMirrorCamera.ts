import { useEffect, useRef, useState, type RefObject } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { PARALLAX } from '../config'
import {
  detectIntervalMs,
  getDeviceQuality,
  mirrorCameraConstraints,
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

const MIN_APPEARANCE_LANDMARKS = 400

export type MirrorCameraStatus =
  | 'starting'
  | 'active'
  | 'denied'
  | 'unavailable'

export type MirrorCameraDeviceOption = { deviceId: string; label: string }

export type MirrorCameraHandle = {
  videoRef: RefObject<HTMLVideoElement | null>
  status: MirrorCameraStatus
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
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[]>([])
  const [signals, setSignals] = useState<MirrorFaceSignals>(
    NEUTRAL_MIRROR_FACE_SIGNALS,
  )
  const [appearance, setAppearance] = useState<FaceAppearance | null>(null)
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
    let cancelled = false
    let stream: MediaStream | null = null
    let permissionTimer: ReturnType<typeof setTimeout> | undefined
    let permissionTimedOut = false

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
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            ...mirrorCameraConstraints(),
            ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : {}),
          },
        })
        clearTimeout(permissionTimer)
        permissionTimer = undefined
        if (permissionTimedOut) {
          stream.getTracks().forEach((track) => track.stop())
          stream = null
          return
        }
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
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
        setStatus(
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? 'denied'
            : 'unavailable',
        )
      }
    }

    void start()

    return () => {
      cancelled = true
      clearTimeout(permissionTimer)
      // Only stop tracks we own — not the parent's shared stream.
      if (stream && stream !== (window.parent as any).__mirrorCameraStream) {
        stream.getTracks().forEach((track) => track.stop())
      }
      const video = videoRef.current
      if (video) {
        video.pause()
        video.srcObject = null
      }
    }
  }, [selectedDeviceId])

  useEffect(() => {
    if (!tracking || status !== 'active') {
      if (!tracking) {
        setLandmarks([])
        setSignals(NEUTRAL_MIRROR_FACE_SIGNALS)
        appearanceRef.current = null
        setAppearance(null)
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
        setLandmarks(detectedLandmarks)
        setSignals(
          detectedLandmarks.length > 0
            ? deriveMirrorFaceSignals(
                result.faceBlendshapes?.[0]?.categories,
                result.facialTransformationMatrixes?.[0]?.data,
              )
            : NEUTRAL_MIRROR_FACE_SIGNALS,
        )
        if (detectedLandmarks.length >= MIN_APPEARANCE_LANDMARKS) {
          missedFaces = 0
          const next = appearanceFromLandmarks(video, detectedLandmarks)
          const smoothed = next
            ? smoothAppearance(appearanceRef.current, next)
            : null
          appearanceRef.current = smoothed
          setAppearance(smoothed)
        } else {
          missedFaces += 1
          if (missedFaces > 8) {
            appearanceRef.current = null
            setAppearance(null)
          }
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
    landmarks,
    signals,
    appearance,
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
