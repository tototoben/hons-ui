import { mulberry32 } from './wallMatchPhotobash'

/**
 * Pool of pre-gathered synthetic face stills (e.g. thispersondoesnotexist.com
 * output) the collage photobash assembles a "stranger" face from before
 * slowly swapping pieces for the visitor's own captured face. Deliberately
 * NOT live-fetched from Flickr/thispersondoesnotexist at runtime — a kiosk
 * at a live venue can't depend on external services staying up, and
 * synthetic faces sidestep any consent/licensing question a real stranger's
 * photo would raise. Run `npm run face-bank:manifest` after adding images to
 * public/assets/wall-avatar/face-bank/.
 */
export const FACE_BANK_DIR = '/assets/wall-avatar/face-bank/'
const MANIFEST_URL = `${FACE_BANK_DIR}manifest.json`

let manifestPromise: Promise<string[]> | null = null

export function loadFaceBankManifest(): Promise<string[]> {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL)
      .then((res) => (res.ok ? res.json() : { files: [] }))
      .then((data: { files?: string[] }) => data.files ?? [])
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

/** Fetches the manifest (if needed) and loads every listed face image. */
export async function loadFaceBankImages(): Promise<HTMLImageElement[]> {
  const files = await loadFaceBankManifest()
  const images = await Promise.allSettled(files.map((file) => loadImage(`${FACE_BANK_DIR}${file}`)))
  return images
    .filter((result): result is PromiseFulfilledResult<HTMLImageElement> => result.status === 'fulfilled')
    .map((result) => result.value)
}
