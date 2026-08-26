import { useEffect, useState, type ReactNode } from 'react'
import {
  readMirrorPreviewMode,
  writeMirrorPreviewMode,
  type MirrorPreviewMode,
} from '../lib/mirrorPreviewMode'

const SHORTCUT = 'fills'

/**
 * No visible control for this anymore — typing "fills" (case-insensitive,
 * ignored while a text field is focused so it can't fire mid-answer)
 * toggles between portrait and fill preview, replacing the on-screen
 * button so nothing on screen implies a fixed monitor shape.
 */
export function MirrorPreviewFrame({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<MirrorPreviewMode>(readMirrorPreviewMode)

  useEffect(() => {
    let buffer = ''
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.length !== 1) return
      const target = document.activeElement
      const isTyping =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (isTyping) {
        buffer = ''
        return
      }
      buffer = (buffer + event.key.toLowerCase()).slice(-SHORTCUT.length)
      if (buffer !== SHORTCUT) return
      buffer = ''
      setMode((current) => {
        const next = current === 'fill' ? 'portrait' : 'fill'
        writeMirrorPreviewMode(next)
        return next
      })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return <div className={`mirror-preview-frame experience-mirror-preview-${mode}`}>{children}</div>
}
