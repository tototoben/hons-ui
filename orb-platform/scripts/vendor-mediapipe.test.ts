import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
}

describe('vendor-mediapipe npm wiring', () => {
  it('runs the vendor script before dev and build', () => {
    expect(pkg.scripts.predev).toBe('node scripts/vendor-mediapipe.mjs')
    expect(pkg.scripts.prebuild).toBe('node scripts/vendor-mediapipe.mjs')
    expect(pkg.scripts['prebuild:reveal']).toBe('node scripts/vendor-mediapipe.mjs')
  })
})
