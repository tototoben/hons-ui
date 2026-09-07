#!/usr/bin/env node
// Scans orb-platform/public/assets/wall-avatar/face-bank/ for image files and
// writes manifest.json. Existing visual tags are preserved by filename; new
// files get default tags so they still load in the collage until tagged.
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'orb-platform',
  'public',
  'assets',
  'wall-avatar',
  'face-bank',
)
const manifestPath = path.join(dir, 'manifest.json')

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const DEFAULT_TAGS = {
  presentation: 'androgynous',
  ageBand: 'young',
  hairColor: 'brown',
  hairLength: 'medium',
  skin: 'medium',
  facialHair: 'none',
  glasses: false,
  smile: false,
}

const TAG_KEYS = Object.keys(DEFAULT_TAGS)

function asFace(file, raw) {
  const next = { file, ...DEFAULT_TAGS }
  if (!raw || typeof raw !== 'object') return next
  for (const key of TAG_KEYS) {
    if (raw[key] !== undefined) next[key] = raw[key]
  }
  return next
}

const existingByFile = new Map()
try {
  const previous = JSON.parse(await readFile(manifestPath, 'utf8'))
  const rows = Array.isArray(previous.faces)
    ? previous.faces
    : Array.isArray(previous.files)
      ? previous.files.map((file) => ({ file }))
      : []
  for (const row of rows) {
    const file = typeof row === 'string' ? row : row?.file
    if (typeof file === 'string' && file) existingByFile.set(file, row)
  }
} catch {
  // First run, or a broken manifest — we rewrite from the directory listing.
}

const entries = await readdir(dir, { withFileTypes: true })
const files = entries
  .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
  .map((entry) => entry.name)
  .sort()

const faces = files.map((file) => asFace(file, existingByFile.get(file)))
const untagged = faces.filter((face) => {
  const prev = existingByFile.get(face.file)
  return !prev || typeof prev === 'string' || typeof prev.presentation !== 'string'
})

await writeFile(manifestPath, `${JSON.stringify({ faces }, null, 2)}\n`)

console.log(`Wrote manifest.json with ${faces.length} face(s).`)
if (untagged.length > 0) {
  console.log(`Untagged (defaults): ${untagged.map((face) => face.file).join(', ')}`)
}
if (faces.length === 0) {
  console.log(`Drop image files into ${dir} then re-run this script.`)
}
