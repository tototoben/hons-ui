export const MATCH_FACE_URL = '/assets/wall-avatar/match-face.png'
export const VISITOR_FACE_URL = '/assets/wall-avatar/visitor-face.jpg'
export const MATCH_FACE_SIZE = { width: 864, height: 960 }

/** Irregular puzzle shards of the visitor drawn over the base match face. */
const USER_SHARDS: Array<Array<[number, number]>> = [
  // upper-left hair / brow
  [
    [0.02, 0.0],
    [0.38, 0.0],
    [0.44, 0.18],
    [0.28, 0.3],
    [0.06, 0.26],
    [0.0, 0.12],
  ],
  // left eye plate
  [
    [0.1, 0.28],
    [0.42, 0.24],
    [0.5, 0.36],
    [0.46, 0.5],
    [0.22, 0.52],
    [0.08, 0.42],
  ],
  // right temple / eye
  [
    [0.56, 0.12],
    [0.92, 0.06],
    [1.0, 0.28],
    [0.96, 0.48],
    [0.7, 0.5],
    [0.54, 0.34],
  ],
  // nose + mid cheek zig
  [
    [0.38, 0.34],
    [0.58, 0.32],
    [0.62, 0.52],
    [0.5, 0.62],
    [0.36, 0.54],
  ],
  // mouth / lower lip wedge
  [
    [0.3, 0.58],
    [0.7, 0.56],
    [0.76, 0.72],
    [0.52, 0.84],
    [0.26, 0.74],
  ],
  // chin tip
  [
    [0.34, 0.78],
    [0.66, 0.76],
    [0.62, 0.96],
    [0.5, 1.0],
    [0.36, 0.96],
  ],
  // lower-left jaw
  [
    [0.0, 0.46],
    [0.22, 0.5],
    [0.3, 0.74],
    [0.12, 0.92],
    [0.0, 0.78],
  ],
]

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load ${src}`))
    image.src = src
  })
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

/**
 * Build a puzzle-fragment photobash: match-face base + visitor shards.
 * Returns a data URL suitable for the wall blanket.
 */
export async function composeWallMatchPhotobash(
  width = MATCH_FACE_SIZE.width,
  height = MATCH_FACE_SIZE.height,
) {
  const [baseImage, visitorImage] = await Promise.all([
    loadImage(MATCH_FACE_URL),
    loadImage(VISITOR_FACE_URL),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  // Base: generated match face
  coverDrawImage(ctx, baseImage, 0, 0, width, height, 0.45)

  // Puzzle shards of the visitor
  for (const shard of USER_SHARDS) {
    ctx.save()
    tracePolygon(ctx, shard, width, height)
    ctx.clip()
    coverDrawImage(ctx, visitorImage, 0, 0, width, height, 0.38)
    ctx.restore()
  }

  // Crack / seam lines between fragments
  ctx.save()
  ctx.strokeStyle = 'rgba(8, 6, 4, 0.55)'
  ctx.lineWidth = Math.max(1.5, width * 0.0024)
  ctx.lineJoin = 'round'
  for (const shard of USER_SHARDS) {
    tracePolygon(ctx, shard, width, height)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(255, 244, 232, 0.18)'
  ctx.lineWidth = Math.max(0.8, width * 0.0012)
  for (const shard of USER_SHARDS) {
    tracePolygon(ctx, shard, width, height)
    ctx.stroke()
  }
  ctx.restore()

  // Subtle vignette so shards settle into one plate
  const wash = ctx.createRadialGradient(
    width * 0.5,
    height * 0.45,
    width * 0.2,
    width * 0.5,
    height * 0.5,
    width * 0.72,
  )
  wash.addColorStop(0, 'rgba(0,0,0,0)')
  wash.addColorStop(1, 'rgba(10, 8, 6, 0.28)')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, width, height)

  return canvas.toDataURL('image/jpeg', 0.92)
}

export function getWallMatchShardCount() {
  return USER_SHARDS.length
}
