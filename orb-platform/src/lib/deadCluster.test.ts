import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, '..', 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>
}

const deadPackages = ['animejs', 'face-api.js', 'motion', 'ogl'] as const

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

  it('does not keep a stale pnpm lockfile for removed packages', () => {
    const pnpmLockPath = join(root, '..', 'pnpm-lock.yaml')
    if (!existsSync(pnpmLockPath)) return
    const lock = readFileSync(pnpmLockPath, 'utf8')
    for (const name of deadPackages) {
      expect(lock).not.toMatch(new RegExp(`(?:^|\\s)${name.replace('.', '\\.')}:`))
    }
  })
})
