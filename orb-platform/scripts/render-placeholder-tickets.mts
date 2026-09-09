/**
 * Offline placeholder souvenir tickets using the real photobash composite path.
 *
 *   npm run render:placeholder-tickets
 */
import { createCanvas, loadImage, type Canvas, type Image } from 'canvas'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ORB_ROOT = join(__dirname, '..')
const REPO_ROOT = join(ORB_ROOT, '../..')
const ASSETS = join(ORB_ROOT, 'public/assets/wall-avatar')
const FACE_BANK_DIR = join(ASSETS, 'face-bank')
const OUT_DIR = join(REPO_ROOT, 'placeholder-tickets')

const LABEL_MM = 62
const LABEL_DPI = 300
const TICKET_W = Math.round((LABEL_MM / 25.4) * LABEL_DPI)

function assetPath(url: string): string | null {
  const marker = '/assets/wall-avatar/'
  const index = url.indexOf(marker)
  if (index === -1) return null
  return join(ASSETS, url.slice(index + marker.length))
}

function canvasToBlob(canvas: Canvas, type = 'image/png'): Promise<Blob> {
  const buffer = canvas.toBuffer(type === 'image/jpeg' ? 'image/jpeg' : 'image/png')
  return Promise.resolve(new Blob([buffer], { type }))
}

;(globalThis as typeof globalThis & { Image: typeof loadImage }).Image =
  loadImage as unknown as typeof Image

const probe = createCanvas(1, 1) as Canvas & {
  toBlob?: (callback: (blob: Blob | null) => void, type?: string) => void
}
if (!probe.toBlob) {
  probe.constructor.prototype.toBlob = function toBlob(
    callback: (blob: Blob | null) => void,
    type = 'image/png',
  ) {
    const canvas = this as Canvas
    const buffer = canvas.toBuffer(type === 'image/jpeg' ? 'image/jpeg' : 'image/png')
    callback(new Blob([buffer], { type }))
  }
}

globalThis.document = {
  createElement(tag: string) {
    if (tag !== 'canvas') throw new Error(`unsupported element: ${tag}`)
    return createCanvas(1, 1) as unknown as HTMLCanvasElement
  },
} as Document

globalThis.fetch = async (input: string | URL | Request) => {
  const url = String(input)
  const path = assetPath(url)
  if (path && existsSync(path)) {
    const bytes = readFileSync(path)
    const type = path.endsWith('.json')
      ? 'application/json'
      : path.endsWith('.jpg')
        ? 'image/jpeg'
        : 'image/png'
    return new Response(bytes, { status: 200, headers: { 'Content-Type': type } })
  }
  return new Response(null, { status: 404 })
}

const { parseFaceBankManifest } = await import('../src/lib/faceBank.ts')
const { renderWallSouvenirPng } = await import('../src/lib/wallSouvenirComposite.ts')
const { wallSouvenirTicketInputFromVisit } = await import('../src/lib/wallSouvenirTicket.ts')
const { resetCollageBankCache, seedCollageBank } = await import('../src/lib/wallCollageBank.ts')
const { DEFAULT_VISITOR_ALIGN } = await import('../src/lib/wallMatchPhotobash.ts')

const manifest = parseFaceBankManifest(
  JSON.parse(readFileSync(join(FACE_BANK_DIR, 'manifest.json'), 'utf8')),
)

async function warmBank(seed: number, cue: Record<string, unknown>) {
  const images = await Promise.all(
    manifest.map((face) => loadImage(join(FACE_BANK_DIR, face.file))),
  )
  seedCollageBank(seed, cue, {
    images: images as unknown as HTMLImageElement[],
    aligns: images.map(() => ({ ...DEFAULT_VISITOR_ALIGN })),
    faces: manifest,
  })
}

type Example = {
  id: string
  seed: number
  cue: Record<string, unknown>
}

const EXAMPLES: Example[] = [
  { id: 'a', seed: 77, cue: { presentations: ['woman'], ageBand: 'young', smile: true } },
  { id: 'b', seed: 203, cue: { presentations: ['man'], ageBand: 'mid', smile: false } },
]

function scaleToTicket(canvas: Canvas): Canvas {
  const scale = TICKET_W / canvas.width
  const ticketH = Math.max(1, Math.round(canvas.height * scale))
  const out = createCanvas(TICKET_W, ticketH)
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#f5f5f0'
  ctx.fillRect(0, 0, TICKET_W, ticketH)
  ctx.drawImage(canvas as unknown as Canvas, 0, 0, TICKET_W, ticketH)
  return out
}

function saveCanvas(canvas: Canvas, path: string) {
  writeFileSync(path, canvas.toBuffer('image/png'))
}

async function renderExample(example: Example) {
  const ticket = wallSouvenirTicketInputFromVisit(null, {
    photobashSeed: example.seed,
    collageCue: example.cue,
  })

  const compositionBlob = await renderWallSouvenirPng(
    example.seed,
    example.cue,
    ticket,
    { drawTicketText: false },
  )
  const ticketBlob = await renderWallSouvenirPng(example.seed, example.cue, ticket, {
    drawTicketText: true,
  })

  const compositionImg = await loadImage(Buffer.from(await compositionBlob.arrayBuffer()))
  const ticketImg = await loadImage(Buffer.from(await ticketBlob.arrayBuffer()))

  const compositionCanvas = createCanvas(compositionImg.width, compositionImg.height)
  compositionCanvas.getContext('2d')!.drawImage(compositionImg, 0, 0)

  const fullTicketCanvas = createCanvas(ticketImg.width, ticketImg.height)
  fullTicketCanvas.getContext('2d')!.drawImage(ticketImg, 0, 0)

  const printCanvas = scaleToTicket(fullTicketCanvas)

  const compPath = join(OUT_DIR, `placeholder-ticket-${example.id}-composition.png`)
  const labeledPath = join(OUT_DIR, `placeholder-ticket-${example.id}-with-text.png`)
  const printPath = join(OUT_DIR, `placeholder-ticket-${example.id}-print.png`)
  saveCanvas(compositionCanvas, compPath)
  saveCanvas(fullTicketCanvas, labeledPath)
  saveCanvas(printCanvas, printPath)

  console.log(`${example.id}: ${compPath} (face only)`)
  console.log(`${example.id}: ${labeledPath} (with captions)`)
  console.log(`${example.id}: ${printPath} (${printCanvas.width}×${printCanvas.height}, print strip)`)
}

mkdirSync(OUT_DIR, { recursive: true })
for (const example of EXAMPLES) {
  resetCollageBankCache()
  await warmBank(example.seed, example.cue)
  await renderExample(example)
}
