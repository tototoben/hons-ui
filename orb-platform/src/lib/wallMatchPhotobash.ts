export const MATCH_FACE_URL = '/assets/wall-avatar/match-face.png'
export const VISITOR_FACE_URL = '/assets/wall-avatar/visitor-face.jpg'
export const MATCH_FACE_SIZE = { width: 864, height: 960 }

export const VISITOR_ALIGN_STORAGE_KEY = 'hons-wall-visitor-align'

/** How the visitor still sits on the match plate (manual lineup). */
export type VisitorAlign = {
  /** Multiplier on cover size (1 = default cover). */
  scale: number
  /** Horizontal shift as a fraction of plate width (−0.5…0.5). */
  offsetX: number
  /** Vertical shift as a fraction of plate height (−0.5…0.5). */
  offsetY: number
}

export const DEFAULT_VISITOR_ALIGN: VisitorAlign = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
}

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

export function normalizeVisitorAlign(value: Partial<VisitorAlign> | null | undefined): VisitorAlign {
  const scale = typeof value?.scale === 'number' && Number.isFinite(value.scale) ? value.scale : 1
  const offsetX =
    typeof value?.offsetX === 'number' && Number.isFinite(value.offsetX) ? value.offsetX : 0
  const offsetY =
    typeof value?.offsetY === 'number' && Number.isFinite(value.offsetY) ? value.offsetY : 0
  return {
    scale: Math.max(0.5, Math.min(2.5, scale)),
    offsetX: Math.max(-0.45, Math.min(0.45, offsetX)),
    offsetY: Math.max(-0.45, Math.min(0.45, offsetY)),
  }
}

export function loadVisitorAlign(): VisitorAlign {
  if (typeof window === 'undefined') return { ...DEFAULT_VISITOR_ALIGN }
  try {
    const raw = window.localStorage.getItem(VISITOR_ALIGN_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_VISITOR_ALIGN }
    return normalizeVisitorAlign(JSON.parse(raw) as Partial<VisitorAlign>)
  } catch {
    return { ...DEFAULT_VISITOR_ALIGN }
  }
}

export function saveVisitorAlign(align: VisitorAlign) {
  const next = normalizeVisitorAlign(align)
  window.localStorage.setItem(VISITOR_ALIGN_STORAGE_KEY, JSON.stringify(next))
  return next
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

/** Draw the visitor still with manual scale / pan on top of the match plate. */
export function drawVisitorAligned(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
  width: number,
  height: number,
  align: VisitorAlign = DEFAULT_VISITOR_ALIGN,
) {
  const next = normalizeVisitorAlign(align)
  const drawW = width * next.scale
  const drawH = height * next.scale
  const dx = (width - drawW) / 2 + next.offsetX * width
  const dy = (height - drawH) / 2 + next.offsetY * height
  coverDrawImage(ctx, image, dx, dy, drawW, drawH, 0.38)
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
  /** Manual visitor lineup; defaults to saved / default align. */
  align?: VisitorAlign
  /** When true, draw a translucent full visitor plate (aligner onion skin). */
  onionOpacity?: number
  /** Draw shard outlines in the aligner only (not on the wall). */
  showShardGuides?: boolean
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
  const align = normalizeVisitorAlign(options.align ?? loadVisitorAlign())
  const onionOpacity = Math.max(0, Math.min(1, options.onionOpacity ?? 0))

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

  if (onionOpacity > 0) {
    ctx.save()
    ctx.globalAlpha = onionOpacity
    drawVisitorAligned(ctx, visitorImage, width, height, align)
    ctx.restore()
  }

  const drawShard = (shard: Array<[number, number]>, opacity: number) => {
    if (opacity <= 0) return
    ctx.save()
    tracePolygon(ctx, shard, width, height)
    ctx.clip()
    ctx.globalAlpha = opacity
    drawVisitorAligned(ctx, visitorImage, width, height, align)
    ctx.restore()
  }

  for (let i = 0; i < shardCount; i += 1) {
    drawShard(USER_SHARDS[i], 1)
  }
  if (shardCount < USER_SHARDS.length && nextShardOpacity > 0) {
    drawShard(USER_SHARDS[shardCount], nextShardOpacity)
  }

  if (options.showShardGuides) {
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 80, 60, 0.85)'
    ctx.lineWidth = Math.max(1.5, width * 0.0025)
    ctx.setLineDash([6, 5])
    for (const shard of USER_SHARDS) {
      tracePolygon(ctx, shard, width, height)
      ctx.stroke()
    }
    ctx.restore()
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

export function getWallMatchShards() {
  return USER_SHARDS.map((shard) => shard.map(([x, y]) => [x, y] as [number, number]))
}
