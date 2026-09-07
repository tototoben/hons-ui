import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { base } from '../config'
import faceBankSource from './faceBank.ts?raw'
import {
  DEFAULT_FACE_TAGS,
  FACE_BANK_DIR,
  facesMatching,
  parseFaceBankFace,
  parseFaceBankManifest,
  pickFaceBankFiles,
} from './faceBank'

const manifestPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../public/assets/wall-avatar/face-bank/manifest.json',
)

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
    expect(faceBankSource).toContain("FACE_BANK_DIR = base('/assets/wall-avatar/face-bank/')")
    expect(FACE_BANK_DIR).toBe(base('/assets/wall-avatar/face-bank/'))
    expect(FACE_BANK_DIR).toBe('/orb/assets/wall-avatar/face-bank/')
    expect(FACE_BANK_DIR.endsWith('/')).toBe(true)
  })

  it('fills default tags for a legacy filename row', () => {
    expect(parseFaceBankFace('random-person.jpeg')).toEqual({
      file: 'random-person.jpeg',
      ...DEFAULT_FACE_TAGS,
    })
  })

  it('keeps tagged fields and drops unknown ones', () => {
    expect(
      parseFaceBankFace({
        file: 'a.jpg',
        presentation: 'woman',
        ageBand: 'mid',
        hairColor: 'red',
        hairLength: 'long',
        skin: 'deep',
        facialHair: 'none',
        glasses: true,
        smile: true,
        extra: 'ignore',
      }),
    ).toEqual({
      file: 'a.jpg',
      presentation: 'woman',
      ageBand: 'mid',
      hairColor: 'red',
      hairLength: 'long',
      skin: 'deep',
      facialHair: 'none',
      glasses: true,
      smile: true,
    })
  })

  it('reads the faces list and still accepts a legacy files list', () => {
    expect(
      parseFaceBankManifest({
        faces: [{ file: 'a.jpg', presentation: 'man', hairColor: 'black' }],
      }).map((face) => face.file),
    ).toEqual(['a.jpg'])
    expect(parseFaceBankManifest({ files: ['b.jpg', 'b.jpg', 'c.jpg'] }).map((face) => face.file)).toEqual([
      'b.jpg',
      'c.jpg',
    ])
    expect(parseFaceBankManifest(null)).toEqual([])
  })

  it('filters faces by the tags fragment assignment will use', () => {
    const faces = parseFaceBankManifest({
      faces: [
        { file: 'w.jpg', presentation: 'woman', hairColor: 'blonde', ageBand: 'young' },
        { file: 'm.jpg', presentation: 'man', hairColor: 'blonde', ageBand: 'mid' },
        { file: 'g.jpg', presentation: 'woman', hairColor: 'gray', glasses: true },
      ],
    })
    expect(facesMatching(faces, { presentation: 'woman' }).map((face) => face.file)).toEqual(['w.jpg', 'g.jpg'])
    expect(facesMatching(faces, { hairColor: 'blonde', ageBand: 'mid' }).map((face) => face.file)).toEqual([
      'm.jpg',
    ])
    expect(facesMatching(faces, { glasses: true }).map((face) => face.file)).toEqual(['g.jpg'])
  })

  it('tags every still in the live photobank manifest', () => {
    const faces = parseFaceBankManifest(JSON.parse(readFileSync(manifestPath, 'utf8')))
    expect(faces.length).toBeGreaterThanOrEqual(20)
    expect(new Set(faces.map((face) => face.file)).size).toBe(faces.length)
    faces.forEach((face) => {
      expect(face.file.length).toBeGreaterThan(0)
      expect(['woman', 'man', 'androgynous']).toContain(face.presentation)
      expect(['child', 'young', 'mid', 'older']).toContain(face.ageBand)
      expect(['black', 'brown', 'blonde', 'red', 'gray', 'none']).toContain(face.hairColor)
    })
  })
})
