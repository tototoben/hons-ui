#!/usr/bin/env node
// Scans orb-platform/public/assets/wall-avatar/face-bank/ for image files and
// writes manifest.json listing them, so the collage photobash can pick from
// however many faces are actually dropped in there without a hardcoded count.
import { readdir, writeFile } from 'node:fs/promises'
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

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

const entries = await readdir(dir, { withFileTypes: true })
const files = entries
  .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
  .map((entry) => entry.name)
  .sort()

await writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ files }, null, 2) + '\n')

console.log(`Wrote manifest.json with ${files.length} face(s).`)
if (files.length === 0) {
  console.log(`Drop image files into ${dir} then re-run this script.`)
}
