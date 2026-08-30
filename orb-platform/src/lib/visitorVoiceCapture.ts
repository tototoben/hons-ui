/**
 * Station III voice take, held in memory for Photobash to play back.
 * Same session-only pattern as visitorFaceCapture: never written to disk.
 */

let currentBlob: Blob | null = null
let currentUrl: string | null = null

function revokeCurrentUrl() {
  if (currentUrl) URL.revokeObjectURL(currentUrl)
  currentUrl = null
}

export function setVisitorVoiceCapture(blob: Blob | null) {
  revokeCurrentUrl()
  currentBlob = blob
  currentUrl = blob ? URL.createObjectURL(blob) : null
}

export function getVisitorVoiceBlob(): Blob | null {
  return currentBlob
}

export function getVisitorVoiceUrl(): string | null {
  return currentUrl
}

export function resetVisitorVoiceCapture() {
  revokeCurrentUrl()
  currentBlob = null
}
