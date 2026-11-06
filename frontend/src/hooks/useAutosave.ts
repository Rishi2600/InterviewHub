import { useEffect, useRef, useState } from 'react'

export type AutosaveState = 'saved' | 'pending' | 'saving' | 'failed'

/**
 * Saves `value` a moment after it stops changing. Only real changes are
 * sent, saves never overlap, and a failed save is retried on the next edit.
 */
export function useAutosave<T>(value: T, save: (value: T) => Promise<unknown>, { delayMs = 800, enabled = true } = {}) {
  const [state, setState] = useState<AutosaveState>('saved')
  const lastSaved = useRef(JSON.stringify(value))
  const running = useRef<Promise<unknown>>(Promise.resolve())
  // The latest save function, without restarting the timer when it changes.
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })

  const serialized = JSON.stringify(value)
  useEffect(() => {
    if (!enabled || serialized === lastSaved.current) return
    setState('pending')
    const id = window.setTimeout(() => {
      running.current = running.current
        .catch(() => undefined)
        .then(async () => {
          setState('saving')
          try {
            await saveRef.current(JSON.parse(serialized) as T)
            lastSaved.current = serialized
            setState('saved')
          } catch {
            setState('failed')
          }
        })
    }, delayMs)
    return () => window.clearTimeout(id)
  }, [serialized, delayMs, enabled])

  return state
}
