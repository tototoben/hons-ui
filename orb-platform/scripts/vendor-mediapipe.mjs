import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const wasmDest = join(root, 'public', 'mediapipe', 'wasm')
const taskDest = join(root, 'public', 'mediapipe', 'face_landmarker.task')
const TASK_SOURCE =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const REQUIRED_WASM = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (!existsSync(wasmSrc) || !statSync(wasmSrc).isDirectory()) {
  fail('Missing node_modules/@mediapipe/tasks-vision/wasm. Run npm install in orb-platform.')
}

mkdirSync(wasmDest, { recursive: true })
for (const name of readdirSync(wasmSrc)) {
  copyFileSync(join(wasmSrc, name), join(wasmDest, name))
}
for (const name of REQUIRED_WASM) {
  if (!existsSync(join(wasmDest, name))) {
    fail(`Vendor copy missing ${name}`)
  }
}

if (!existsSync(taskDest)) {
  mkdirSync(dirname(taskDest), { recursive: true })
  const response = await fetch(TASK_SOURCE)
  if (!response.ok) {
    fail(`Failed to download face_landmarker.task (${response.status})`)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  writeFileSync(taskDest, bytes)
}

if (!existsSync(taskDest)) {
  fail('face_landmarker.task is missing after vendor')
}

console.log('Vendored MediaPipe wasm and face_landmarker.task')
