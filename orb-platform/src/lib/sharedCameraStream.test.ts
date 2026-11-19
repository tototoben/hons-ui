import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acquireCameraStream, stopSharedCameraStream } from './sharedCameraStream'

function fakeStream(label: string) {
  const track = { readyState: 'live', stop: vi.fn(() => { track.readyState = 'ended' }) }
  return { label, active: true, track, getTracks: () => [track] } as unknown as MediaStream & {
    label: string
    track: { stop: ReturnType<typeof vi.fn> }
  }
}

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('sharedCameraStream', () => {
  const getUserMedia = vi.fn()

  beforeEach(() => {
    getUserMedia.mockReset()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    stopSharedCameraStream()
  })
  afterEach(() => {
    stopSharedCameraStream()
    vi.unstubAllGlobals()
  })

  it('reuses the live stream for the same device', async () => {
    const a = fakeStream('a')
    getUserMedia.mockResolvedValueOnce(a)
    expect(await acquireCameraStream({}, 'x')).toBe(a)
    expect(await acquireCameraStream({}, 'x')).toBe(a)
    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })

  it('does not let a superseded request replace the newer stream', async () => {
    const slow = deferred<MediaStream>()
    const fast = deferred<MediaStream>()
    getUserMedia.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise)

    const first = acquireCameraStream({}, 'old')
    const second = acquireCameraStream({}, 'new')

    const newer = fakeStream('new')
    fast.resolve(newer)
    expect(await second).toBe(newer)

    const older = fakeStream('old')
    slow.resolve(older)
    // The late request gets the winner, and its own stream is released.
    expect(await first).toBe(newer)
    expect(older.track.stop).toHaveBeenCalled()
    expect(newer.track.stop).not.toHaveBeenCalled()
    // Later callers for the new device still get the newer stream.
    expect(await acquireCameraStream({}, 'new')).toBe(newer)
    expect(getUserMedia).toHaveBeenCalledTimes(2)
  })

  it('hands a superseded request the newer pending stream', async () => {
    const slow = deferred<MediaStream>()
    const fast = deferred<MediaStream>()
    getUserMedia.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise)

    const first = acquireCameraStream({}, 'old')
    const second = acquireCameraStream({}, 'new')

    const older = fakeStream('old')
    slow.resolve(older)
    await Promise.resolve()
    const newer = fakeStream('new')
    fast.resolve(newer)
    expect(await first).toBe(newer)
    expect(await second).toBe(newer)
    expect(older.track.stop).toHaveBeenCalled()
  })

  it('discards a stream that finishes after the camera was released', async () => {
    const late = deferred<MediaStream>()
    getUserMedia.mockReturnValueOnce(late.promise)
    const request = acquireCameraStream({}, null)
    stopSharedCameraStream()
    const stream = fakeStream('late')
    late.resolve(stream)
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(stream.track.stop).toHaveBeenCalled()
  })
})
