import { useCallback, useEffect, useRef, useState } from 'react'
import { parseWallRole, type WallRole } from '../lib/wallRole'
import './RevealShellChrome.css'

/**
 * Operational chrome for windows hosted by the `components/reveal` Tauri
 * shell: hover swap picker, target-display pairing, ⟳ content rotation
 * (non-wall windows only), and Ctrl/Cmd+Alt nudging.
 *
 * Everything is gated on a Tauri global (`window.__TAURI__`), so the same
 * orb build renders as a normal browser page everywhere else. Reads the
 * `view` query param (which view this reveal window shows) and `wallRole`.
 */

type TauriShell = {
  core: {
    invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
  }
  event: {
    listen: (event: string, cb: (e: { payload: unknown }) => void) => Promise<() => void>
  }
}

type SwapNavigatePayload = {
  from: number
  to: number
  urlFrom: string
  urlTo: string
}

type DisplayChoice = { id: string; label: string }

function getTauri(): TauriShell | null {
  if (typeof window === 'undefined') return null
  const t = (window as unknown as { __TAURI__?: TauriShell }).__TAURI__
  if (!t) return null
  return t
}

export function RevealShellChrome() {
  const [tauri] = useState(getTauri)
  const view = useRef<number | null>(null)
  const wallRole = useRef<WallRole | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [views, setViews] = useState<number>(0)
  const [displays, setDisplays] = useState<DisplayChoice[]>([])
  const [isWallRole, setIsWallRole] = useState(false)
  const swapSelectRef = useRef<HTMLSelectElement>(null)
  const displaySelectRef = useRef<HTMLSelectElement>(null)
  const pickerBusy = useRef(false)

  useEffect(() => {
    if (!tauri) return
    const params = new URLSearchParams(window.location.search)
    const rawView = Number(params.get('view'))
    if (Number.isInteger(rawView) && rawView > 0) view.current = rawView
    wallRole.current = parseWallRole()
    setIsWallRole(wallRole.current !== null)
  }, [tauri])

  const showPicker = useCallback((payload: unknown) => {
    if (typeof payload === 'number') setViews(payload)
    setPickerOpen(true)
    void refreshDisplays()
  }, [])

  const refreshDisplays = useCallback(async () => {
    if (!tauri) return
    try {
      const list = (await tauri.core.invoke('list_displays')) as DisplayChoice[]
      setDisplays(list)
    } catch {
      setDisplays([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tauri])

  useEffect(() => {
    if (!tauri) return
    const shown = tauri.event.listen('swap-reveal', (e) => showPicker(e.payload))
    const hidden = tauri.event.listen('swap-hide', () => setPickerOpen(false))
    const navigate = tauri.event.listen('swap-navigate', (e) => {
      const p = e.payload as SwapNavigatePayload
      const current = view.current
      if (current === null) return
      if (current === p.from) window.location.href = p.urlTo
      else if (current === p.to) window.location.href = p.urlFrom
    })
    return () => {
      void shown.then((off) => off())
      void hidden.then((off) => off())
      void navigate.then((off) => off())
    }
  }, [tauri, showPicker])

  useEffect(() => {
    if (!tauri) return
    const body = document.body
    const onMove = () => void tauri.core.invoke('swap_preview_on').catch(() => {})
    const onLeave = () => void tauri.core.invoke('swap_preview_off').catch(() => {})
    body.addEventListener('mousemove', onMove)
    body.addEventListener('mouseleave', onLeave)
    return () => {
      body.removeEventListener('mousemove', onMove)
      body.removeEventListener('mouseleave', onLeave)
    }
  }, [tauri])

  useEffect(() => {
    if (!tauri) return
    const step = (e: KeyboardEvent) => (e.shiftKey ? 40 : 10)
    const deltas: Record<string, (e: KeyboardEvent) => [number, number]> = {
      ArrowLeft: (e) => [-step(e), 0],
      ArrowRight: (e) => [step(e), 0],
      ArrowUp: (e) => [0, -step(e)],
      ArrowDown: (e) => [0, step(e)],
    }
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !e.altKey) return
      const current = view.current
      if (current === null) return
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        void tauri.core.invoke('rotate_window', { view: current }).catch(() => {})
        return
      }
      const delta = deltas[e.key]
      if (!delta) return
      e.preventDefault()
      const [dx, dy] = delta(e)
      void tauri.core.invoke('nudge_window', { view: current, dx, dy }).catch(() => {})
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tauri])

  if (!tauri || view.current === null) return null

  const swap = (value: string) => {
    const to = Number(value)
    if (!to || pickerBusy.current) return
    pickerBusy.current = true
    setPickerOpen(false)
    void tauri.core
      .invoke('swap_window', { from: view.current!, to })
      .catch(() => {})
      .finally(() => {
        pickerBusy.current = false
      })
  }

  const moveToDisplay = (value: string) => {
    if (!value) return
    pickerBusy.current = true
    setPickerOpen(false)
    void tauri.core
      .invoke('move_window_to_display', { view: view.current!, id: value })
      .catch(() => {})
      .finally(() => {
        pickerBusy.current = false
      })
  }

  const rotate = () => {
    pickerBusy.current = true
    setPickerOpen(false)
    void tauri.core
      .invoke('rotate_view', { view: view.current! })
      .catch(() => {})
      .finally(() => {
        pickerBusy.current = false
      })
  }

  return (
    // The drag veil makes the whole window a move surface during the
    // picker; the controls sit above it and ignore the drag region.
    <div
      className={`reveal-shell-chrome${pickerOpen ? ' is-open' : ''}`}
      aria-hidden="true"
      data-testid="reveal-shell-chrome"
    >
      <div className="reveal-shell-drag-veil" data-tauri-drag-region></div>
      <div className="reveal-shell-bar">
        {pickerOpen ? (
          <>
            <select
              ref={swapSelectRef}
              className="reveal-shell-select"
              aria-label="swap view"
              data-tauri-drag-region-ignore
              value=""
              onChange={(e) => swap(e.target.value)}
            >
              <option value="" disabled>
                swap {view.current}
              </option>
              {Array.from({ length: views || 0 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            <select
              ref={displaySelectRef}
              className="reveal-shell-select"
              aria-label="target display"
              data-tauri-drag-region-ignore
              value=""
              onChange={(e) => moveToDisplay(e.target.value)}
            >
              <option value="" disabled>
                → display
              </option>
              {displays.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            {!isWallRole ? (
              <button
                className="reveal-shell-btn"
                title="rotate content 90° (saved)"
                data-tauri-drag-region-ignore
                onClick={rotate}
              >
                ⟳
              </button>
            ) : null}
            <span className="reveal-shell-note">
              {wallRole.current ? `role ${wallRole.current}` : `view ${view.current}`}
            </span>
          </>
        ) : null}
      </div>
    </div>
  )
}