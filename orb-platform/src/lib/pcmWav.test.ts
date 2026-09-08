import { describe, expect, it } from 'vitest'
import { concatFloat32, downsampleTo16k, encodeWav } from './pcmWav'

describe('pcmWav', () => {
  it('downsamples a 48 kHz buffer to 16 kHz', () => {
    const input = new Float32Array(4800)
    input.fill(0.25)
    const out = downsampleTo16k(input, 48000)
    expect(out.length).toBe(1600)
    expect(out[0]).toBeCloseTo(0.25)
  })

  it('writes a RIFF WAVE header for 16 kHz mono PCM', async () => {
    const blob = encodeWav(new Float32Array([0, 0.5, -0.5]), 16000)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF')
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE')
    expect(blob.type).toBe('audio/wav')
    expect(bytes.length).toBe(44 + 6)
  })

  it('concatenates float chunks in order', () => {
    const out = concatFloat32([new Float32Array([1, 2]), new Float32Array([3])])
    expect(Array.from(out)).toEqual([1, 2, 3])
  })
})
