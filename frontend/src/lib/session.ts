import type { User } from '@/types'

const TOKEN_KEY = 'interviewhub.token'
const USER_KEY = 'interviewhub.user'

/** Fired when the session is cleared from outside React (e.g. by the axios
 *  401 interceptor) so AuthContext can react without a page reload. */
export const SESSION_CLEARED_EVENT = 'interviewhub:session-cleared'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    // Corrupted entry — treat it as no session rather than crashing on boot.
    localStorage.removeItem(USER_KEY)
    return null
  }
}

export function saveSession(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function saveUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  const had = localStorage.getItem(TOKEN_KEY) !== null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  if (had) {
    window.dispatchEvent(new CustomEvent(SESSION_CLEARED_EVENT))
  }
}