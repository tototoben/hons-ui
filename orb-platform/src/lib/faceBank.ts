import { base } from '../config'
import { mulberry32 } from './wallMatchPhotobash'

/**
 * Pool of pre-gathered face stills the collage photobash assembles a
 * "stranger" face from before slowly swapping pieces for the visitor's
 * own captured face. Deliberately NOT live-fetched at runtime — a kiosk
 * at a live venue can't depend on external services staying up.
 *
 * Tags on each still are visual (presentation, age band, hair, skin).
 * Collage fragments follow Station I/II answers via collageCue.ts.
 * Run `npm run face-bank:manifest` after adding images — the script keeps
 * tags already in manifest.json and fills defaults for new files.
 */
export const FACE_BANK_DIR = base('/assets/wall-avatar/face-bank/')
const MANIFEST_URL = `${FACE_BANK_DIR}manifest.json`

export const FACE_PRESENTATIONS = ['woman', 'man', 'androgynous'] as const
export const FACE_AGE_BANDS = ['child', 'young', 'mid', 'older'] as const
export const FACE_HAIR_COLORS = ['black', 'brown', 'blonde', 'red', 'gray', 'none'] as const
export const FACE_HAIR_LENGTHS = ['bald', 'short', 'medium', 'long'] as const
export const FACE_SKIN_TONES = ['light', 'medium', 'deep'] as const
export const FACE_FACIAL_HAIR = ['none', 'stubble', 'beard'] as const

export type FacePresentation = (typeof FACE_PRESENTATIONS)[number]
export type FaceAgeBand = (typeof FACE_AGE_BANDS)[number]
export type FaceHairColor = (typeof FACE_HAIR_COLORS)[number]
export type FaceHairLength = (typeof FACE_HAIR_LENGTHS)[number]
export type FaceSkin = (typeof FACE_SKIN_TONES)[number]
export type FaceFacialHair = (typeof FACE_FACIAL_HAIR)[number]

export type FaceBankFace = {
  file: string
  presentation: FacePresentation
  ageBand: FaceAgeBand
  hairColor: FaceHairColor
  hairLength: FaceHairLength
  skin: FaceSkin
  facialHair: FaceFacialHair
  glasses: boolean
  smile: boolean
}

export const DEFAULT_FACE_TAGS: Omit<FaceBankFace, 'file'> = {
  presentation: 'androgynous',
  ageBand: 'young',
  hairColor: 'brown',
  hairLength: 'medium',
  skin: 'medium',
  facialHair: 'none',
  glasses: false,
  smile: false,
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

export function parseFaceBankFace(value: unknown): FaceBankFace | null {
  if (typeof value === 'string' && value.length > 0) {
    return { file: value, ...DEFAULT_FACE_TAGS }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const file = typeof raw.file === 'string' ? raw.file : typeof raw.src === 'string' ? raw.src : ''
  if (!file) return null
  return {
    file,
    presentation: oneOf(raw.presentation, FACE_PRESENTATIONS, DEFAULT_FACE_TAGS.presentation),
    ageBand: oneOf(raw.ageBand, FACE_AGE_BANDS, DEFAULT_FACE_TAGS.ageBand),
    hairColor: oneOf(raw.hairColor, FACE_HAIR_COLORS, DEFAULT_FACE_TAGS.hairColor),
    hairLength: oneOf(raw.hairLength, FACE_HAIR_LENGTHS, DEFAULT_FACE_TAGS.hairLength),
    skin: oneOf(raw.skin, FACE_SKIN_TONES, DEFAULT_FACE_TAGS.skin),
    facialHair: oneOf(raw.facialHair, FACE_FACIAL_HAIR, DEFAULT_FACE_TAGS.facialHair),
    glasses: raw.glasses === true,
    smile: raw.smile === true,
  }
}

export function parseFaceBankManifest(value: unknown): FaceBankFace[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  const raw = value as { faces?: unknown; files?: unknown }
  const rows = Array.isArray(raw.faces)
    ? raw.faces
    : Array.isArray(raw.files)
      ? raw.files
      : []
  const faces: FaceBankFace[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const face = parseFaceBankFace(row)
    if (!face || seen.has(face.file)) continue
    seen.add(face.file)
    faces.push(face)
  }
  return faces
}

export type FaceTagQuery = Partial<
  Pick<FaceBankFace, 'presentation' | 'ageBand' | 'hairColor' | 'hairLength' | 'skin' | 'facialHair'>
> & { glasses?: boolean; smile?: boolean }

export function facesMatching(faces: FaceBankFace[], query: FaceTagQuery = {}): FaceBankFace[] {
  return faces.filter((face) => {
    if (query.presentation && face.presentation !== query.presentation) return false
    if (query.ageBand && face.ageBand !== query.ageBand) return false
    if (query.hairColor && face.hairColor !== query.hairColor) return false
    if (query.hairLength && face.hairLength !== query.hairLength) return false
    if (query.skin && face.skin !== query.skin) return false
    if (query.facialHair && face.facialHair !== query.facialHair) return false
    if (query.glasses !== undefined && face.glasses !== query.glasses) return false
    if (query.smile !== undefined && face.smile !== query.smile) return false
    return true
  })
}

let manifestPromise: Promise<FaceBankFace[]> | null = null

export function resetFaceBankManifestCache() {
  manifestPromise = null
}

export function loadFaceBankManifest(): Promise<FaceBankFace[]> {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL)
      .then((res) => (res.ok ? res.json() : { faces: [] }))
      .then((data: unknown) => parseFaceBankManifest(data))
      .catch(() => [])
  }
  return manifestPromise
}

const imageCache = new Map<string, Promise<HTMLImageElement>>()

function loadImage(src: string) {
  const cached = imageCache.get(src)
  if (cached) return cached
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => {
      imageCache.delete(src)
      reject(new Error(`Failed to load ${src}`))
    }
    image.src = src
  })
  imageCache.set(src, pending)
  return pending
}

/** Seeded pick so every wall panel loads the same subset in the same order. */
export function pickFaceBankFiles(files: string[], seed: number, count = files.length): string[] {
  if (files.length === 0) return []
  const rand = mulberry32(seed)
  const order = files.map((_, index) => index)
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order.slice(0, Math.min(count, files.length)).map((index) => files[index])
}

export type FaceBankEntry = {
  face: FaceBankFace
  image: HTMLImageElement
}

/** Fetches the manifest and loads every listed face, keeping tags aligned with images. */
export async function loadFaceBankEntries(): Promise<FaceBankEntry[]> {
  const faces = await loadFaceBankManifest()
  const results = await Promise.allSettled(
    faces.map(async (face) => {
      const image = await loadImage(`${FACE_BANK_DIR}${face.file}`)
      return { face, image } satisfies FaceBankEntry
    }),
  )
  return results
    .filter((result): result is PromiseFulfilledResult<FaceBankEntry> => result.status === 'fulfilled')
    .map((result) => result.value)
}

/** Fetches the manifest (if needed) and loads every listed face image. */
export async function loadFaceBankImages(): Promise<HTMLImageElement[]> {
  return (await loadFaceBankEntries()).map((entry) => entry.image)
}
