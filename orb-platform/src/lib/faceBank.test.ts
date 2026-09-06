import { describe, expect, it } from 'vitest'
import { base } from '../config'
import { FACE_BANK_DIR, pickFaceBankFiles } from './faceBank'

describe('faceBank', () => {
  it('returns an empty pick when there are no files', () => {
    expect(pickFaceBankFiles([], 1)).toEqual([])
  })

  it('picks a seeded, deterministic order', () => {
    const files = ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg']
    const a = pickFaceBankFiles(files, 5)
    const b = pickFaceBankFiles(files, 5)
    expect(a).toEqual(b)
    expect(a).toHaveLength(files.length)
    expect(new Set(a)).toEqual(new Set(files))
  })

  it('respects a requested count', () => {
    const files = ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg']
    expect(pickFaceBankFiles(files, 5, 2)).toHaveLength(2)
  })

  it('prefixes the face-bank directory with the Vite base URL', () => {
    expect(FACE_BANK_DIR).toBe(base('/assets/wall-avatar/face-bank/'))
    expect(FACE_BANK_DIR.endsWith('/')).toBe(true)
  })
})
