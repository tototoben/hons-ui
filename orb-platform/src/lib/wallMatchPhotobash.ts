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

/** Tuned on the face-align tool. */
export const DEFAULT_VISITOR_ALIGN: VisitorAlign = {
  scale: 1.62,
  offsetX: -0.00938,
  offsetY: -0.17378,
}

export type FaceShard = Array<[number, number]>

/**
 * Pool of small visitor cuts. Each reveal picks a random subset so coverage
 * stays roughly 30–45% but the puzzle pattern changes.
 */
const SHARD_POOL: FaceShard[] = [
  // right eye
  [
    [0.54, 0.33],
    [0.72, 0.32],
    [0.74, 0.4],
    [0.68, 0.44],
    [0.56, 0.43],
    [0.52, 0.38],
  ],
  // left eye
  [
    [0.26, 0.33],
    [0.44, 0.32],
    [0.46, 0.41],
    [0.4, 0.45],
    [0.28, 0.44],
    [0.24, 0.38],
  ],
  // nose bridge → tip
  [
    [0.46, 0.4],
    [0.54, 0.4],
    [0.53, 0.55],
    [0.5, 0.58],
    [0.47, 0.55],
  ],
  // right half mouth
  [
    [0.5, 0.62],
    [0.68, 0.61],
    [0.7, 0.69],
    [0.58, 0.73],
    [0.5, 0.69],
  ],
  // left half mouth
  [
    [0.3, 0.62],
    [0.5, 0.61],
    [0.5, 0.7],
    [0.38, 0.73],
    [0.28, 0.68],
  ],
  // brow / forehead chip
  [
    [0.34, 0.18],
    [0.58, 0.16],
    [0.6, 0.28],
    [0.42, 0.32],
    [0.32, 0.26],
  ],
  // right cheek
  [
    [0.62, 0.42],
    [0.78, 0.4],
    [0.82, 0.56],
    [0.7, 0.6],
    [0.6, 0.52],
  ],
  // left cheek / jaw
  [
    [0.18, 0.44],
    [0.34, 0.42],
    [0.36, 0.6],
    [0.24, 0.66],
    [0.14, 0.54],
  ],
  // chin tip
  [
    [0.4, 0.74],
    [0.6, 0.74],
    [0.58, 0.9],
    [0.5, 0.94],
    [0.42, 0.9],
  ],
  // philtrum / upper lip center
  [
    [0.44, 0.56],
    [0.56, 0.56],
    [0.58, 0.64],
    [0.5, 0.66],
    [0.42, 0.64],
  ],
  // temple wedge
  [
    [0.72, 0.22],
    [0.9, 0.2],
    [0.92, 0.36],
    [0.78, 0.4],
    [0.7, 0.3],
  ],
]

/** How many shards to draw per reveal (from the larger pool). */
export const SHARDS_PER_REVEAL: { min: number; max: number } = { min: 4, max: 6 }

/** Clean match hold before glitch bursts begin. */
export const MATCH_HOLD_MS: number = 6_000

/** Glitchy match↔merge window after the clean hold. */
export const PHOTOBASH_GLITCH_MS: number = 40_000

/** @deprecated Reveal no longer fades shards; kept for align tooling. */
export const PHOTOBASH_REVEAL_MS: number = MATCH_HOLD_MS + PHOTOBASH_GLITCH_MS

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
  const scale =
    typeof value?.scale === 'number' && Number.isFinite(value.scale)
      ? value.scale
      : DEFAULT_VISITOR_ALIGN.scale
  const offsetX =
    typeof value?.offsetX === 'number' && Number.isFinite(value.offsetX)
      ? value.offsetX
      : DEFAULT_VISITOR_ALIGN.offsetX
  const offsetY =
    typeof value?.offsetY === 'number' && Number.isFinite(value.offsetY)
      ? value.offsetY
      : DEFAULT_VISITOR_ALIGN.offsetY
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

/** Seeded 0–1 RNG so every wall panel draws the same random shards. */
export function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Pick a random subset of shards for one reveal cycle. */
export function pickRevealShards(
  seed: number,
  pool: FaceShard[] = SHARD_POOL,
  counts: { min: number; max: number } = SHARDS_PER_REVEAL,
): FaceShard[] {
  const rand = mulberry32(seed)
  const span = Math.max(0, counts.max - counts.min)
  const pickCount = Math.min(pool.length, counts.min + Math.floor(rand() * (span + 1)))
  const order = pool.map((_, index) => index)
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order.slice(0, pickCount).map((index) => pool[index].map(([x, y]) => [x, y] as [number, number]))
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
  /** Shards to draw this cycle (randomized subset). Defaults to full pool. */
  shards?: FaceShard[]
}

/**
 * Build a sparse puzzle photobash: match-face base + a few visitor feature shards.
 * Returns a data URL suitable for the wall blanket.
 */
export async function composeWallMatchPhotobash(options: PhotobashComposeOptions = {}) {
  const width = options.width ?? MATCH_FACE_SIZE.width
  const height = options.height ?? MATCH_FACE_SIZE.height
  const shards = options.shards ?? SHARD_POOL
  const shardCount = Math.max(0, Math.min(shards.length, options.shardCount ?? shards.length))
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

  const drawShard = (shard: FaceShard, opacity: number) => {
    if (opacity <= 0) return
    ctx.save()
    tracePolygon(ctx, shard, width, height)
    ctx.clip()
    ctx.globalAlpha = opacity
    drawVisitorAligned(ctx, visitorImage, width, height, align)
    ctx.restore()
  }

  for (let i = 0; i < shardCount; i += 1) {
    drawShard(shards[i], 1)
  }
  if (shardCount < shards.length && nextShardOpacity > 0) {
    drawShard(shards[shardCount], nextShardOpacity)
  }

  if (options.showShardGuides) {
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 80, 60, 0.85)'
    ctx.lineWidth = Math.max(1.5, width * 0.0025)
    ctx.setLineDash([6, 5])
    for (const shard of shards) {
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
export function photobashRevealAt(
  elapsedMs: number,
  totalMs: number = PHOTOBASH_REVEAL_MS,
  shardTotal: number = SHARDS_PER_REVEAL.max,
) {
  const total = Math.max(1, shardTotal)
  const progress = Math.max(0, Math.min(1, elapsedMs / totalMs))
  const exact = progress * total
  const shardCount = Math.min(total, Math.floor(exact))
  const nextShardOpacity =
    shardCount >= total ? 0 : Math.max(0, Math.min(1, exact - shardCount))
  return { shardCount, nextShardOpacity, progress }
}

/**
 * Choppy glitch gate: clean match first, then irregular flashes of the
 * pre-merged photobash. Seeded so every wall panel stays in sync.
 */
export function glitchShowMergedAt(elapsedMs: number, seed: number): boolean {
  if (elapsedMs < MATCH_HOLD_MS) return false
  const t = elapsedMs - MATCH_HOLD_MS
  const intensity = Math.min(1, t / (PHOTOBASH_GLITCH_MS * 0.55))
  const burst = Math.floor(t / 380)
  const burstRoll = mulberry32((seed ^ 0x9e3779b9) + burst * 9973)()
  const inBurst = burstRoll < 0.18 + intensity * 0.42
  if (!inBurst) {
    // Late cycle: occasional long holds on the merge.
    if (intensity > 0.75) {
      const holdRoll = mulberry32(seed + burst * 131)()
      return holdRoll < 0.35
    }
    return false
  }
  const flicker = mulberry32(seed + Math.floor(t / 70) * 17)()
  return flicker < 0.5 + intensity * 0.35
}

export function getWallMatchShardPoolCount() {
  return SHARD_POOL.length
}

/** @deprecated Prefer getWallMatchShardPoolCount — kept for older tests. */
export function getWallMatchShardCount() {
  return SHARD_POOL.length
}

export function getWallMatchShards() {
  return SHARD_POOL.map((shard) => shard.map(([x, y]) => [x, y] as [number, number]))
}
