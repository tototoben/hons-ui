import type { NormalizedLandmark } from './mirrorLandmarks'

export type Rgb = { r: number; g: number; b: number }

export type ColorSwatch = {
  hex: string
  label: string
}

export type MorphometricReading = {
  term: string
  finding: string
}

export type FaceAppearance = {
  hair: ColorSwatch
  eyes: ColorSwatch
  morphometrics: MorphometricReading[]
}

export type ImageDataLike = {
  width: number
  height: number
  data: ArrayLike<number>
}

export type FrameSize = {
  width: number
  height: number
}

const FACE = {
  forehead: 10,
  glabella: 9,
  nasion: 6,
  noseTip: 1,
  subnasale: 2,
  chin: 152,
  leftZygo: 234,
  rightZygo: 454,
  leftGonion: 172,
  rightGonion: 397,
  leftMedialCanthus: 133,
  leftLateralCanthus: 33,
  rightMedialCanthus: 362,
  rightLateralCanthus: 263,
  leftCheek: 50,
  rightCheek: 280,
  leftCheekOuter: 116,
  rightCheekOuter: 345,
  foreheadCenter: 151,
  leftNostril: 48,
  rightNostril: 278,
  mouthLeft: 61,
  mouthRight: 291,
  labialeSuperius: 0,
  labialeInferius: 17,
  upperLip: 13,
  lowerLip: 14,
  leftTemple: 54,
  rightTemple: 284,
  leftHair: 67,
  rightHair: 297,
  leftUpperLid: 159,
  leftLowerLid: 145,
  rightUpperLid: 386,
  rightLowerLid: 374,
}

const FACE_REF_INDICES = [
  FACE.leftCheek,
  FACE.rightCheek,
  FACE.leftCheekOuter,
  FACE.rightCheekOuter,
  FACE.foreheadCenter,
]

const LEFT_IRIS_RING = [469, 470, 471, 472]
const RIGHT_IRIS_RING = [474, 475, 476, 477]

export function rgbToHex({ r, g, b }: Rgb) {
  return `#${channelHex(r)}${channelHex(g)}${channelHex(b)}`
}

export function classifyHairColor(color: Rgb): ColorSwatch {
  const { h, s, l } = rgbToHsl(color)
  let label = 'brown'
  if (l < 0.17) label = 'black'
  else if (s < 0.14 && l >= 0.42) label = 'gray'
  else if ((h <= 28 || h >= 350) && s > 0.52 && l > 0.28 && l < 0.58) label = 'red'
  else if (h >= 32 && h <= 58 && l > 0.48 && s >= 0.18 && s < 0.72) label = 'blonde'
  return { label, hex: rgbToHex(color) }
}

export function classifyEyeColor(color: Rgb): ColorSwatch {
  const { h, s, l } = rgbToHsl(color)
  let label = 'brown'
  if (s < 0.16 && l >= 0.28 && l <= 0.72) label = 'gray'
  else if (h >= 185 && h <= 255 && s >= 0.12) label = 'blue'
  else if (h >= 85 && h <= 165 && s >= 0.12) label = 'green'
  else if (h >= 32 && h <= 58 && l >= 0.3 && s >= 0.28) label = 'hazel'
  else if (l < 0.16) label = 'brown'
  return { label, hex: rgbToHex(color) }
}

export function sampleAverageColor(
  image: ImageDataLike,
  points: Array<{ x: number; y: number }>,
  radius = 1,
  accept?: (color: Rgb) => boolean,
): Rgb | null {
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  const extent = Math.max(0, Math.round(radius))

  for (const point of points) {
    const cx = Math.round(point.x)
    const cy = Math.round(point.y)
    for (let dy = -extent; dy <= extent; dy += 1) {
      for (let dx = -extent; dx <= extent; dx += 1) {
        const x = cx + dx
        const y = cy + dy
        if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue
        const index = (y * image.width + x) * 4
        const color = {
          r: Number(image.data[index]),
          g: Number(image.data[index + 1]),
          b: Number(image.data[index + 2]),
        }
        if (!Number.isFinite(color.r) || (accept && !accept(color))) continue
        r += color.r
        g += color.g
        b += color.b
        count += 1
      }
    }
  }

  if (count === 0) return null
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  }
}

export function sampleFaceColorRegions(
  image: ImageDataLike,
  landmarks: NormalizedLandmark[],
): { hair: Rgb | null; eyes: Rgb | null } {
  const frame = { width: image.width, height: image.height }
  const faceRef = sampleAverageColor(
    image,
    landmarkPixels(landmarks, FACE_REF_INDICES, frame),
    2,
  )
  const hair = sampleAverageColor(
    image,
    hairPixels(landmarks, frame),
    2,
    (color) => isPlausibleHair(color, faceRef),
  )
  const eyes = sampleAverageColor(
    image,
    [
      ...landmarkPixels(landmarks, LEFT_IRIS_RING, frame),
      ...landmarkPixels(landmarks, RIGHT_IRIS_RING, frame),
    ],
    1,
    isPlausibleIris,
  )

  return { hair, eyes }
}

export function deriveFaceMorphometrics(
  landmarks: NormalizedLandmark[],
  frame: FrameSize,
): MorphometricReading[] {
  if (landmarks.length === 0 || frame.width < 2 || frame.height < 2) return []

  const at = (index: number) => pixel(landmarks[index], frame)
  const readings: MorphometricReading[] = []

  const leftMedial = at(FACE.leftMedialCanthus)
  const leftLateral = at(FACE.leftLateralCanthus)
  const rightMedial = at(FACE.rightMedialCanthus)
  const rightLateral = at(FACE.rightLateralCanthus)
  if (leftMedial && leftLateral && rightMedial && rightLateral) {
    const tilt = (canthalTilt(leftMedial, leftLateral) + canthalTilt(rightMedial, rightLateral)) / 2
    readings.push({
      term: 'canthal tilt',
      finding: `${tiltLabel(tilt)}, ${formatDegrees(tilt)}`,
    })

    const palpebral =
      (distance(leftMedial, leftLateral) + distance(rightMedial, rightLateral)) / 2
    const intercanthal = distance(leftMedial, rightMedial)
    if (palpebral > 1) {
      const ratio = intercanthal / palpebral
      readings.push({
        term: 'eye spacing',
        finding: `${spacingLabel(ratio)}, ICD/PF ${ratio.toFixed(2)}`,
      })
    }
  }

  const forehead = at(FACE.forehead)
  const chin = at(FACE.chin)
  const leftZygo = at(FACE.leftZygo)
  const rightZygo = at(FACE.rightZygo)
  const faceHeight = forehead && chin ? distance(forehead, chin) : 0
  const bizygomatic = leftZygo && rightZygo ? distance(leftZygo, rightZygo) : 0
  const facialIndex = bizygomatic > 1 ? (faceHeight / bizygomatic) * 100 : 0
  if (facialIndex > 0) {
    readings.push({
      term: 'facial index',
      finding: `${facialIndexLabel(facialIndex)}, ${facialIndex.toFixed(1)}`,
    })
  }

  const leftNostril = at(FACE.leftNostril)
  const rightNostril = at(FACE.rightNostril)
  const nasion = at(FACE.nasion)
  const subnasale = at(FACE.subnasale)
  const noseWidth = leftNostril && rightNostril ? distance(leftNostril, rightNostril) : 0
  const noseHeight = nasion && subnasale ? distance(nasion, subnasale) : 0
  if (noseWidth > 1 && noseHeight > 1) {
    const nasalIndex = (noseWidth / noseHeight) * 100
    readings.push({
      term: 'nasal index',
      finding: `${nasalIndexLabel(nasalIndex)}, ${nasalIndex.toFixed(1)}`,
    })
  }

  const leftGonion = at(FACE.leftGonion)
  const rightGonion = at(FACE.rightGonion)
  const bigonial = leftGonion && rightGonion ? distance(leftGonion, rightGonion) : 0
  if (bigonial > 1 && bizygomatic > 1) {
    const jawRatio = bigonial / bizygomatic
    readings.push({
      term: 'mandibular width',
      finding: `${jawLabel(jawRatio)}, ${jawRatio.toFixed(2)}× zygoma`,
    })
  }

  if (facialIndex > 0) {
    const jawRatio = bigonial > 1 && bizygomatic > 1 ? bigonial / bizygomatic : 0.85
    readings.push({
      term: 'face shape',
      finding: faceShapeLabel(facialIndex, jawRatio),
    })
  }

  const leftUpper = at(FACE.leftUpperLid)
  const leftLower = at(FACE.leftLowerLid)
  const rightUpper = at(FACE.rightUpperLid)
  const rightLower = at(FACE.rightLowerLid)
  if (leftMedial && leftLateral && leftUpper && leftLower && rightUpper && rightLower) {
    const leftWidth = distance(leftMedial, leftLateral)
    const rightWidth = rightMedial && rightLateral ? distance(rightMedial, rightLateral) : leftWidth
    const height =
      (distance(leftUpper, leftLower) + distance(rightUpper, rightLower)) / 2
    const width = (leftWidth + rightWidth) / 2
    if (width > 1) {
      const index = height / width
      readings.push({
        term: 'palpebral fissure',
        finding: `${fissureLabel(index)}, index ${index.toFixed(2)}`,
      })
    }
  }

  if (nasion && subnasale && chin) {
    const mid = distance(nasion, subnasale)
    const lower = distance(subnasale, chin)
    if (mid > 1 && lower > 1) {
      const ratio = mid / lower
      readings.push({
        term: 'midface ratio',
        finding: `${midfaceLabel(ratio)}, ${ratio.toFixed(2)}`,
      })
    }
  }

  const upperLipTop = at(FACE.labialeSuperius)
  const upperLip = at(FACE.upperLip)
  const lowerLip = at(FACE.lowerLip)
  const lowerLipBottom = at(FACE.labialeInferius)
  if (upperLipTop && upperLip && lowerLip && lowerLipBottom) {
    const upper = distance(upperLipTop, upperLip)
    const lower = distance(lowerLip, lowerLipBottom)
    if (upper > 0.5 && lower > 0.5) {
      const ratio = upper / lower
      readings.push({
        term: 'lip ratio',
        finding: `${lipLabel(ratio)}, ${ratio.toFixed(2)}`,
      })
    }
  }

  if (leftZygo && leftGonion && chin) {
    const angle = angleAt(leftZygo, leftGonion, chin)
    if (angle > 0) {
      readings.push({
        term: 'gonial angle',
        finding: `${gonialLabel(angle)}, ${Math.round(angle)}°`,
      })
    }
  }

  return readings
}

export function formatMorphometricLine({ term, finding }: MorphometricReading) {
  const separator = finding.indexOf(', ')
  if (separator === -1) return `${finding} ${term}`
  return `${finding.slice(0, separator)} ${term}, ${finding.slice(separator + 2)}`
}

export function deriveFaceAppearance({
  hair,
  eyes,
  landmarks,
  frame,
}: {
  hair: Rgb | null
  eyes: Rgb | null
  landmarks: NormalizedLandmark[]
  frame: FrameSize
}): FaceAppearance {
  return {
    hair: hair ? classifyHairColor(hair) : { label: 'undetected', hex: '#888888' },
    eyes: eyes ? classifyEyeColor(eyes) : { label: 'undetected', hex: '#888888' },
    morphometrics: deriveFaceMorphometrics(landmarks, frame),
  }
}

export function readVideoFrame(
  video: HTMLVideoElement,
  maxSize = 180,
): ImageDataLike | null {
  const sourceWidth = video.videoWidth
  const sourceHeight = video.videoHeight
  if (!sourceWidth || !sourceHeight) return null

  const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(2, Math.round(sourceWidth * scale))
  const height = Math.max(2, Math.round(sourceHeight * scale))
  const canvas = getScratchCanvas(width, height)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  try {
    context.drawImage(video, 0, 0, width, height)
    return context.getImageData(0, 0, width, height)
  } catch {
    return null
  }
}

export function smoothAppearance(
  previous: FaceAppearance | null,
  next: FaceAppearance,
  amount = 0.28,
): FaceAppearance {
  if (!previous) return next
  return {
    hair: blendSwatch(previous.hair, next.hair, amount, classifyHairColor),
    eyes: blendSwatch(previous.eyes, next.eyes, amount, classifyEyeColor),
    morphometrics: next.morphometrics,
  }
}

let scratchCanvas: HTMLCanvasElement | null = null

function getScratchCanvas(width: number, height: number) {
  if (typeof document === 'undefined') {
    throw new Error('Video sampling requires a document')
  }
  if (!scratchCanvas) scratchCanvas = document.createElement('canvas')
  scratchCanvas.width = width
  scratchCanvas.height = height
  return scratchCanvas
}

function blendSwatch(
  previous: ColorSwatch,
  next: ColorSwatch,
  amount: number,
  classify: (color: Rgb) => ColorSwatch,
): ColorSwatch {
  if (next.label === 'undetected') return next
  if (previous.label === 'undetected') return next
  return classify(mixRgb(hexToRgb(previous.hex), hexToRgb(next.hex), amount))
}

function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  return {
    r: Math.round(from.r + (to.r - from.r) * amount),
    g: Math.round(from.g + (to.g - from.g) * amount),
    b: Math.round(from.b + (to.b - from.b) * amount),
  }
}

function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '')
  return {
    r: Number.parseInt(value.slice(0, 2), 16) || 0,
    g: Number.parseInt(value.slice(2, 4), 16) || 0,
    b: Number.parseInt(value.slice(4, 6), 16) || 0,
  }
}

function landmarkPixels(
  landmarks: NormalizedLandmark[],
  indices: number[],
  frame: FrameSize,
) {
  return indices
    .map((index) => pixel(landmarks[index], frame))
    .filter((point): point is { x: number; y: number } => Boolean(point))
}

function hairPixels(landmarks: NormalizedLandmark[], frame: FrameSize) {
  const points: Array<{ x: number; y: number }> = []
  const add = (landmark: NormalizedLandmark | undefined, lift: number, sway = 0) => {
    if (!landmark) return
    const y = landmark.y - lift
    const x = landmark.x + sway
    if (y <= 0.01 || x <= 0.02 || x >= 0.98) return
    points.push({
      x: x * (frame.width - 1),
      y: y * (frame.height - 1),
    })
  }

  add(landmarks[FACE.forehead], 0.08)
  add(landmarks[FACE.forehead], 0.06, -0.05)
  add(landmarks[FACE.forehead], 0.06, 0.05)
  add(landmarks[FACE.leftHair], 0.07)
  add(landmarks[FACE.rightHair], 0.07)
  return points
}

function pixel(landmark: NormalizedLandmark | undefined, frame: FrameSize) {
  if (!landmark || !Number.isFinite(landmark.x) || !Number.isFinite(landmark.y)) {
    return null
  }
  return {
    x: landmark.x * (frame.width - 1),
    y: landmark.y * (frame.height - 1),
  }
}

function canthalTilt(
  medial: { x: number; y: number },
  lateral: { x: number; y: number },
) {
  const dx = Math.abs(lateral.x - medial.x)
  if (dx < 0.001) return 0
  return (Math.atan2(medial.y - lateral.y, dx) * 180) / Math.PI
}

function tiltLabel(degrees: number) {
  if (degrees > 2) return 'positive'
  if (degrees < -2) return 'negative'
  return 'neutral'
}

function spacingLabel(ratio: number) {
  if (ratio < 0.9) return 'close-set'
  if (ratio > 1.15) return 'wide-set'
  return 'balanced'
}

function facialIndexLabel(index: number) {
  if (index < 128) return 'euryprosopic'
  if (index <= 145) return 'mesoprosopic'
  return 'leptoprosopic'
}

function nasalIndexLabel(index: number) {
  if (index < 70) return 'leptorrhine'
  if (index <= 85) return 'mesorrhine'
  return 'platyrrhine'
}

function jawLabel(ratio: number) {
  if (ratio < 0.8) return 'narrow'
  if (ratio > 0.95) return 'wide'
  return 'balanced'
}

function faceShapeLabel(index: number, jawRatio: number) {
  if (jawRatio < 0.78 && index >= 110) return 'heart'
  if (index >= 155) return 'oblong'
  if (index <= 122 && jawRatio >= 0.9) return 'round'
  if (index <= 132 && jawRatio >= 0.93) return 'square'
  return 'oval'
}

function fissureLabel(index: number) {
  if (index < 0.28) return 'narrow'
  if (index > 0.42) return 'round'
  return 'almond'
}

function midfaceLabel(ratio: number) {
  if (ratio < 0.85) return 'short midface'
  if (ratio > 1.15) return 'long midface'
  return 'balanced'
}

function lipLabel(ratio: number) {
  if (ratio < 0.7) return 'thinner upper lip'
  if (ratio > 1.15) return 'thinner lower lip'
  return 'balanced'
}

function gonialLabel(angle: number) {
  if (angle < 115) return 'acute'
  if (angle > 132) return 'obtuse'
  return 'average'
}

function formatDegrees(value: number) {
  const rounded = Math.abs(value).toFixed(1)
  return `${value < 0 ? '−' : ''}${rounded}°`
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function angleAt(
  a: { x: number; y: number },
  vertex: { x: number; y: number },
  c: { x: number; y: number },
) {
  const ab = { x: a.x - vertex.x, y: a.y - vertex.y }
  const cb = { x: c.x - vertex.x, y: c.y - vertex.y }
  const magnitude = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y)
  if (magnitude < 0.001) return 0
  return (Math.acos(clamp( (ab.x * cb.x + ab.y * cb.y) / magnitude, -1, 1)) * 180) / Math.PI
}

function isPlausibleHair(color: Rgb, faceRef: Rgb | null) {
  const { h, s, l } = rgbToHsl(color)
  if (s > 0.28 && h > 70 && h < 190) return false
  if (l > 0.88) return false
  if (!faceRef) return true
  return colorDistance(color, faceRef) > 28
}

function isPlausibleIris(color: Rgb) {
  const { s, l } = rgbToHsl(color)
  if (l < 0.08 || l > 0.82) return false
  if (s < 0.05 && l > 0.58) return false
  return true
}

function colorDistance(a: Rgb, b: Rgb) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b)
}

function rgbToHsl({ r, g, b }: Rgb) {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const l = (max + min) / 2
  const delta = max - min
  if (delta === 0) return { h: 0, s: 0, l }

  const s = delta / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (max === red) h = ((green - blue) / delta) % 6
  else if (max === green) h = (blue - red) / delta + 2
  else h = (red - green) / delta + 4
  h *= 60
  if (h < 0) h += 360
  return { h, s, l }
}

function channelHex(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0')
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}
