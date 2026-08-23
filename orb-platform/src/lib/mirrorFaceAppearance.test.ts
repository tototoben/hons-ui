import { describe, expect, it } from 'vitest'
import {
  classifyEyeColor,
  classifyHairColor,
  classifySkinTone,
  deriveFaceAppearance,
  deriveFaceMorphometrics,
  formatMorphometricLine,
  rgbToHex,
  sampleAverageColor,
  type Rgb,
} from './mirrorFaceAppearance'
import type { NormalizedLandmark } from './mirrorLandmarks'

function rgb(r: number, g: number, b: number): Rgb {
  return { r, g, b }
}

function landmarksWith(
  overrides: Record<number, { x: number; y: number; z?: number }>,
  count = 478,
): NormalizedLandmark[] {
  const points = Array.from({ length: count }, () => ({ x: 0.5, y: 0.5, z: 0 }))
  for (const [index, point] of Object.entries(overrides)) {
    points[Number(index)] = { z: 0, ...point }
  }
  return points
}

describe('color classification', () => {
  it('formats sampled RGB as a hex swatch value', () => {
    expect(rgbToHex(rgb(201, 160, 122))).toBe('#c9a07a')
  })

  it('names common hair colors from sampled RGB', () => {
    expect(classifyHairColor(rgb(22, 16, 14)).label).toBe('black')
    expect(classifyHairColor(rgb(86, 54, 36)).label).toBe('brown')
    expect(classifyHairColor(rgb(214, 188, 118)).label).toBe('blonde')
    expect(classifyHairColor(rgb(156, 58, 32)).label).toBe('red')
    expect(classifyHairColor(rgb(168, 168, 172)).label).toBe('gray')
  })

  it('names iris colors and keeps a hex swatch', () => {
    expect(classifyEyeColor(rgb(58, 92, 148))).toMatchObject({
      label: 'blue',
      hex: '#3a5c94',
    })
    expect(classifyEyeColor(rgb(46, 102, 58)).label).toBe('green')
    expect(classifyEyeColor(rgb(96, 62, 36)).label).toBe('brown')
    expect(classifyEyeColor(rgb(148, 118, 52)).label).toBe('hazel')
    expect(classifyEyeColor(rgb(118, 122, 128)).label).toBe('gray')
  })

  it('describes skin with a hex value derived from the sampled tone', () => {
    const light = classifySkinTone(rgb(232, 198, 176))
    expect(light.hex).toBe('#e8c6b0')
    expect(light.label).toBe('light')

    const deep = classifySkinTone(rgb(72, 46, 32))
    expect(deep.hex).toBe('#482e20')
    expect(deep.label).toBe('deep')
  })
})

describe('pixel sampling', () => {
  it('averages a patch of pixels and ignores out-of-bounds samples', () => {
    const image = {
      width: 4,
      height: 2,
      data: new Uint8ClampedArray([
        10, 20, 30, 255, 10, 20, 30, 255, 200, 0, 0, 255, 200, 0, 0, 255,
        10, 20, 30, 255, 10, 20, 30, 255, 200, 0, 0, 255, 200, 0, 0, 255,
      ]),
    }

    expect(sampleAverageColor(image, [{ x: 0.12, y: 0.25 }], 0)).toEqual(rgb(10, 20, 30))
    expect(sampleAverageColor(image, [{ x: 2, y: 9 }])).toBeNull()
  })
})

describe('deriveFaceMorphometrics', () => {
  it('reports negative canthal tilt when both lateral canthi sit lower than the medial canthi', () => {
    const readings = deriveFaceMorphometrics(
      landmarksWith({
        133: { x: 0.42, y: 0.4 },
        33: { x: 0.32, y: 0.41 },
        362: { x: 0.58, y: 0.4 },
        263: { x: 0.68, y: 0.41 },
        10: { x: 0.5, y: 0.18 },
        152: { x: 0.5, y: 0.84 },
        234: { x: 0.22, y: 0.48 },
        454: { x: 0.78, y: 0.48 },
      }),
      { width: 1000, height: 1000 },
    )

    const canthal = readings.find((reading) => reading.term === 'canthal tilt')
    expect(canthal?.finding).toMatch(/^negative, −?5\.\d°$/)
  })

  it('classifies a long narrow face as leptoprosopic', () => {
    const readings = deriveFaceMorphometrics(
      landmarksWith({
        10: { x: 0.5, y: 0.12 },
        152: { x: 0.5, y: 0.92 },
        234: { x: 0.36, y: 0.5 },
        454: { x: 0.64, y: 0.5 },
      }),
      { width: 1000, height: 1000 },
    )

    expect(readings.find((reading) => reading.term === 'facial index')?.finding).toMatch(
      /^leptoprosopic, /,
    )
  })

  it('returns no readings when the mesh is too incomplete to measure', () => {
    expect(deriveFaceMorphometrics([], { width: 1000, height: 1000 })).toEqual([])
  })
})

describe('deriveFaceAppearance', () => {
  it('combines sampled colors with morphometric terms for the HUD', () => {
    const appearance = deriveFaceAppearance({
      hair: rgb(214, 188, 118),
      skin: rgb(232, 198, 176),
      eyes: rgb(46, 102, 58),
      landmarks: landmarksWith({
        133: { x: 0.42, y: 0.4 },
        33: { x: 0.32, y: 0.37 },
        362: { x: 0.58, y: 0.4 },
        263: { x: 0.68, y: 0.37 },
        10: { x: 0.5, y: 0.18 },
        152: { x: 0.5, y: 0.84 },
        234: { x: 0.22, y: 0.48 },
        454: { x: 0.78, y: 0.48 },
        48: { x: 0.44, y: 0.58 },
        278: { x: 0.56, y: 0.58 },
        6: { x: 0.5, y: 0.42 },
        2: { x: 0.5, y: 0.6 },
        172: { x: 0.3, y: 0.72 },
        397: { x: 0.7, y: 0.72 },
      }),
      frame: { width: 1000, height: 1000 },
    })

    expect(appearance.hair.label).toBe('blonde')
    expect(appearance.skin.hex).toBe('#e8c6b0')
    expect(appearance.eyes.label).toBe('green')
    expect(appearance.morphometrics.map((reading) => reading.term)).toEqual(
      expect.arrayContaining([
        'canthal tilt',
        'facial index',
        'nasal index',
        'eye spacing',
        'mandibular width',
        'face shape',
      ]),
    )
  })

  it('marks missing hair as undetected instead of inventing a color', () => {
    const appearance = deriveFaceAppearance({
      hair: null,
      skin: rgb(210, 170, 140),
      eyes: rgb(96, 62, 36),
      landmarks: landmarksWith({
        10: { x: 0.5, y: 0.2 },
        152: { x: 0.5, y: 0.8 },
        234: { x: 0.3, y: 0.5 },
        454: { x: 0.7, y: 0.5 },
      }),
      frame: { width: 1000, height: 1000 },
    })

    expect(appearance.hair.label).toBe('undetected')
  })

  it('turns morphometric findings into readable clinical lines', () => {
    expect(
      formatMorphometricLine({ term: 'canthal tilt', finding: 'negative, −4.2°' }),
    ).toBe('negative canthal tilt, −4.2°')
    expect(formatMorphometricLine({ term: 'face shape', finding: 'oval' })).toBe(
      'oval face shape',
    )
  })
})
