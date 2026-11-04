import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

/** Same key as the inline script in index.html, which applies it before first paint. */
const STORAGE_KEY = 'interviewhub.theme'
const listeners = new Set<() => void>()

function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage can be blocked; the theme still applies for this visit.
  }
  listeners.forEach((notify) => notify())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The light/dark theme, shared by every component that reads it. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme)
  return {
    theme,
    setTheme,
    toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
  }
}
