import { describe, expect, it } from 'vitest'
import { transcribeUrls } from './transcribeIngest'

describe('transcribeUrls', () => {
  it('posts through Vite then the Studio ingest on localhost', () => {
    expect(transcribeUrls('', 'localhost')).toEqual([
      '/orb/__hons/transcribe',
      '/__hons/transcribe',
      'http://127.0.0.1:8190/api/transcribe',
    ])
  })

  it('can be pointed or disabled from the query string', () => {
    expect(transcribeUrls('?stt=https://studio/stt', 'rpi400-3')).toEqual(['https://studio/stt'])
    expect(transcribeUrls('?stt=0', 'localhost')).toEqual([])
  })
})
