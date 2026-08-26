export const MATCH_FACE_URL = '/assets/wall-avatar/match-face.png'
export const VISITOR_FACE_URL = '/assets/wall-avatar/visitor-face.jpg'
export const MATCH_FACE_SIZE = { width: 864, height: 960 }

/** Sparse visitor cuts — roughly 30–40% of the face plate, feature-focused. */
const USER_SHARDS: Array<Array<[number, number]>> = [
  // one eye (viewer-left / subject-right)
  [
    [0.54, 0.33],
    [0.72, 0.32],
    [0.74, 0.4],
    [0.68, 0.44],
    [0.56, 0.43],
    [0.52, 0.38],
  ],
  // a thin nose fragment (bridge → tip)
  [
    [0.46, 0.4],
    [0.54, 0.4],
    [0.53, 0.55],
    [0.5, 0.58],
    [0.47, 0.55],
  ],
  // half the mouth (right side)
  [
    [0.5, 0.62],
    [0.68, 0.61],
    [0.7, 0.69],
    [0.58, 0.73],
    [0.5, 0.69],
  ],
]

/** Full sparse photobash settles in over this window (then holds). */
export const PHOTOBASH_REVEAL_MS = 32_000

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

/** Cover-draw an image into a destination rect, optionally biasing the crop. */
export function coverDrawImage(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  focusY = 0.42,
) {
  const sourceWidth = 'naturalWidth' in image && image.naturalWidth ? image.naturalWidth : image.width
  const sourceHeight =
    'naturalHeight' in image && image.naturalHeight ? image.naturalHeight : image.height
  const imageRatio = sourceWidth / sourceHeight
  const targetRatio = dw / dh

  let sx = 0
  let sy = 0
  let sw = sourceWidth
  let sh = sourceHeight

  if (imageRatio > targetRatio) {
    sh = sourceHeight
    sw = sh * targetRatio
    sx = (sourceWidth - sw) / 2
    sy = 0
  } else {
    sw = sourceWidth
    sh = sw / targetRatio
    sx = 0
    sy = Math.max(0, Math.min(sourceHeight - sh, sourceHeight * focusY - sh / 2))
  }

  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
}

function tracePolygon(
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  width: number,
  height: number,
) {
  ctx.beginPath()
  points.forEach(([x, y], index) => {
    const px = x * width
    const py = y * height
    if (index === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.closePath()
}

export type PhotobashComposeOptions = {
  width?: number
  height?: number
  /** How many visitor shards to draw (0 = match face only). */
  shardCount?: number
  /** Fade 0–1 for the next shard after `shardCount` full pieces. */
  nextShardOpacity?: number
}

/**
 * Build a sparse puzzle photobash: match-face base + a few visitor feature shards.
 * Returns a data URL suitable for the wall blanket.
 */
export async function composeWallMatchPhotobash(options: PhotobashComposeOptions = {}) {
  const width = options.width ?? MATCH_FACE_SIZE.width
  const height = options.height ?? MATCH_FACE_SIZE.height
  const shardCount = Math.max(0, Math.min(USER_SHARDS.length, options.shardCount ?? USER_SHARDS.length))
  const nextShardOpacity = Math.max(0, Math.min(1, options.nextShardOpacity ?? 0))

  const [baseImage, visitorImage] = await Promise.all([
    loadImage(MATCH_FACE_URL),
    loadImage(VISITOR_FACE_URL),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  coverDrawImage(ctx, baseImage, 0, 0, width, height, 0.45)

  const drawShard = (shard: Array<[number, number]>, opacity: number) => {
    if (opacity <= 0) return
    ctx.save()
    tracePolygon(ctx, shard, width, height)
    ctx.clip()
    ctx.globalAlpha = opacity
    coverDrawImage(ctx, visitorImage, 0, 0, width, height, 0.38)
    ctx.restore()

    ctx.save()
    ctx.globalAlpha = opacity
    ctx.strokeStyle = 'rgba(8, 6, 4, 0.5)'
    ctx.lineWidth = Math.max(1.2, width * 0.002)
    ctx.lineJoin = 'round'
    tracePolygon(ctx, shard, width, height)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255, 244, 232, 0.16)'
    ctx.lineWidth = Math.max(0.6, width * 0.001)
    tracePolygon(ctx, shard, width, height)
    ctx.stroke()
    ctx.restore()
  }

  for (let i = 0; i < shardCount; i += 1) {
    drawShard(USER_SHARDS[i], 1)
  }
  if (shardCount < USER_SHARDS.length && nextShardOpacity > 0) {
    drawShard(USER_SHARDS[shardCount], nextShardOpacity)
  }

  if (shardCount > 0 || nextShardOpacity > 0) {
    const wash = ctx.createRadialGradient(
      width * 0.5,
      height * 0.45,
      width * 0.2,
      width * 0.5,
      height * 0.5,
      width * 0.72,
    )
    wash.addColorStop(0, 'rgba(0,0,0,0)')
    wash.addColorStop(1, 'rgba(10, 8, 6, 0.22)')
    ctx.fillStyle = wash
    ctx.fillRect(0, 0, width, height)
  }

  return canvas.toDataURL('image/jpeg', 0.92)
}

/** Map elapsed ms → how many full shards + fade for the next one. */
export function photobashRevealAt(elapsedMs: number, totalMs = PHOTOBASH_REVEAL_MS) {
  const progress = Math.max(0, Math.min(1, elapsedMs / totalMs))
  const exact = progress * USER_SHARDS.length
  const shardCount = Math.min(USER_SHARDS.length, Math.floor(exact))
  const nextShardOpacity =
    shardCount >= USER_SHARDS.length ? 0 : Math.max(0, Math.min(1, exact - shardCount))
  return { shardCount, nextShardOpacity, progress }
}

export function getWallMatchShardCount() {
  return USER_SHARDS.length
}
