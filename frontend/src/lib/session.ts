import type { User } from '@/types'

/**
 * The access token lives only in this module's memory, never in storage, so
 * an injected script cannot copy it out of localStorage. The session itself
 * survives reloads through the httpOnly refresh cookie (docs/AUTH_DESIGN.md).
 */
let accessToken: string | null = null

/** Fired when the session is cleared from outside React (e.g. by the axios
 *  401 interceptor) so AuthContext can react without a page reload. */
export const SESSION_CLEARED_EVENT = 'interviewhub:session-cleared'
/** Fired after a refresh, with the user read fresh from the server. */
export const SESSION_REFRESHED_EVENT = 'interviewhub:session-refreshed'

// Older versions kept the token in localStorage; remove any leftover copy.
try {
  localStorage.removeItem('interviewhub.token')
  localStorage.removeItem('interviewhub.user')
} catch {
  // Storage can be blocked; there is nothing to clean up then.
}

export function getToken(): string | null {
  return accessToken
}

export function setToken(token: string): void {
  accessToken = token
}

export function announceRefresh(user: User): void {
  window.dispatchEvent(new CustomEvent(SESSION_REFRESHED_EVENT, { detail: user }))
}

export function clearSession(): void {
  const had = accessToken !== null
  accessToken = null
  if (had) {
    window.dispatchEvent(new CustomEvent(SESSION_CLEARED_EVENT))
  }
}

/** Seconds since the epoch at which a JWT expires, or 0 if unreadable. */
export function tokenExpiry(token: string): number {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(payload)) as { exp?: number }
    return typeof exp === 'number' ? exp : 0
  } catch {
    return 0
  }
}
