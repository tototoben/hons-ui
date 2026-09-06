import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, '..', 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>
}

describe('dead cluster removal', () => {
  it('removes unused GridScan and orphaned npm packages', () => {
    expect(existsSync(join(root, 'components', 'GridScan.tsx'))).toBe(false)
    expect(existsSync(join(root, 'components', 'MorphSlider.tsx'))).toBe(false)
    expect(existsSync(join(root, 'components', 'Room.tsx'))).toBe(false)
    expect(pkg.dependencies['face-api.js']).toBeUndefined()
    expect(pkg.dependencies.animejs).toBeUndefined()
    expect(pkg.dependencies.ogl).toBeUndefined()
    expect(pkg.dependencies.motion).toBeUndefined()
  })
})
