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

const MIN_APPEARANCE_LANDMARKS = 400

export type MirrorCameraStatus =
  | 'starting'
  | 'active'
  | 'denied'
  | 'unavailable'

export type MirrorCameraHandle = {
  videoRef: RefObject<HTMLVideoElement | null>
  status: MirrorCameraStatus
  landmarks: NormalizedLandmark[]
  signals: MirrorFaceSignals
  appearance: FaceAppearance | null
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

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    let permissionTimer: ReturnType<typeof setTimeout> | undefined
    let permissionTimedOut = false

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setStatus('unavailable')
        return
      }

      try {
        permissionTimer = setTimeout(() => {
          permissionTimedOut = true
          if (!cancelled) setStatus('unavailable')
        }, 4_000)
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: mirrorCameraConstraints(),
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

        if (!cancelled) setStatus('active')
      } catch (error) {
        clearTimeout(permissionTimer)
        permissionTimer = undefined
        if (cancelled) return
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
      stream?.getTracks().forEach((track) => track.stop())
      const video = videoRef.current
      if (video) {
        video.pause()
        video.srcObject = null
      }
    }
  }, [])

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

  return { videoRef, status, landmarks, signals, appearance }
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
    : { hair: null, skin: null, eyes: null }

  return deriveFaceAppearance({
    ...samples,
    landmarks,
    frame,
  })
}
