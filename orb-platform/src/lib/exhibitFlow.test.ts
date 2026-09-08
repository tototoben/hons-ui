import { describe, expect, it } from 'vitest'
import { deriveStationStatus } from './stationStatus'

describe('exhibit flow contracts', () => {
  const visit = {
    visit_id: 'v-flow',
    state: 'station_2',
    active_station: 2,
    station_data: {
      '1': {
        answers: { callName: 'Ada', age: '30', identity: 'woman' },
        faceCapture: 'data:image/jpeg;base64,face',
      },
    },
  }

  it('station 1 completes once interview_done payload is persisted', () => {
    const status = deriveStationStatus(1, [visit], { centralReachable: true })
    expect(status.status).toBe('completed')
    expect(status.visitId).toBe('v-flow')
  })

  it('station 2 is ready when central routes the visitor there', () => {
    const status = deriveStationStatus(2, [visit], { centralReachable: true })
    expect(status.status).toBe('ready')
    expect(status.detail).toContain('Ready')
  })

  it('station 3 waits until the visitor advances past station 2', () => {
    const status = deriveStationStatus(3, [visit], { centralReachable: true })
    expect(status.status).toBe('waiting')
  })
})
