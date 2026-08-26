import { describe, expect, it } from 'vitest'
import { pickFaceBankFiles } from './faceBank'

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
})
