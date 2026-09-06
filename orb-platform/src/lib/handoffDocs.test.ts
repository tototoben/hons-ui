import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// orb-platform/src/lib → src → orb-platform → git root (HANDOFF.md lives there)
const repo = join(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('handoff docs', () => {
  it('reads the three markdown files from git root', () => {
    expect(existsSync(join(repo, 'HANDOFF.md'))).toBe(true)
    expect(existsSync(join(repo, 'CONTEXT.md'))).toBe(true)
    expect(existsSync(join(repo, 'README.md'))).toBe(true)
  })

  it('describes the shipped orb-platform, not an unbuilt MediaPipe plan', () => {
    const handoff = readFileSync(join(repo, 'HANDOFF.md'), 'utf8')
    const context = readFileSync(join(repo, 'CONTEXT.md'), 'utf8')
    const readme = readFileSync(join(repo, 'README.md'), 'utf8')
    expect(handoff).not.toMatch(/approved, not built yet/i)
    expect(handoff).not.toMatch(/no MediaPipe in `package\.json`/)
    expect(context).not.toMatch(/Spec \+ plan approved; not implemented/)
    expect(readme).not.toMatch(/npm run samples:debra/)
    expect(handoff).toMatch(/orb-platform/)
    expect(handoff).toMatch(/MediaPipe/)
  })
})
