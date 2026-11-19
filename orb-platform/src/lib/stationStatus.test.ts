import { describe, expect, it } from 'vitest'
import { WAITING_FOR_PREVIOUS_STATION_INPUT } from './stationStatus'

describe('station waiting copy', () => {
  it('names the previous station as the source of the wait', () => {
    expect(WAITING_FOR_PREVIOUS_STATION_INPUT).toBe('Waiting for previous station input')
  })
})
