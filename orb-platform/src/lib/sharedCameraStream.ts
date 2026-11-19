/**
 * One camera stream for the life of the page.
 *
 * The scan phases mount and unmount the camera view for every visitor. If
 * each mount called getUserMedia and each unmount stopped the tracks, a
 * browser that granted "this time only" (or Safari) would prompt for camera
 * access on every visit. Keeping the first stream alive and handing it to
 * each scan means the permission is asked once per page load. The cost is
 * that the camera indicator stays lit between visitors, which is fine on a
 * kiosk.
 */

type Shared = { stream: MediaStream; deviceId: string | null }

let shared: Shared | null = null
let pending: { promise: Promise<MediaStream>; deviceId: string | null } | null = null
// Bumped whenever a request starts or the camera is released. A getUserMedia
// call that finishes under an older number was superseded while it was in
// flight and must not install its stream (it would replace a newer one).
let generation = 0

function isLive(stream: MediaStream): boolean {
  if (stream.active === false) return false
  const tracks = stream.getTracks?.() ?? []
  return tracks.every((track) => track.readyState !== 'ended')
}

function stopStream(stream: MediaStream) {
  stream.getTracks?.().forEach((track) => track.stop())
}

/** The live shared stream for `deviceId` (null = browser default), opening
 * it on first use. Switching device stops the previous stream. */
export function acquireCameraStream(
  constraints: MediaTrackConstraints,
  deviceId: string | null,
): Promise<MediaStream> {
  if (shared && shared.deviceId === deviceId && isLive(shared.stream)) {
    return Promise.resolve(shared.stream)
  }
  if (pending && pending.deviceId === deviceId) return pending.promise

  if (shared) {
    stopStream(shared.stream)
    shared = null
  }

  const mine = ++generation
  const promise: Promise<MediaStream> = navigator.mediaDevices
    .getUserMedia({
      audio: false,
      video: { ...constraints, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
    })
    .then((stream) => {
      if (mine !== generation) {
        // Superseded (device switched, or the camera released) while this
        // request was open: drop its stream rather than overwrite the newer
        // one, and hand the caller whatever won.
        stopStream(stream)
        if (pending) return pending.promise
        if (shared && isLive(shared.stream)) return shared.stream
        throw new DOMException('Camera request superseded', 'AbortError')
      }
      pending = null
      shared = { stream, deviceId }
      return stream
    })
    .catch((error: unknown) => {
      if (pending?.promise === promise) pending = null
      throw error
    })
  pending = { promise, deviceId }
  return promise
}

export function isSharedCameraStream(stream: MediaStream | null): boolean {
  return Boolean(stream && shared?.stream === stream)
}

/** Stop the shared camera (tests, or an explicit operator release). */
export function stopSharedCameraStream() {
  if (shared) stopStream(shared.stream)
  shared = null
  pending = null
  generation += 1
}
