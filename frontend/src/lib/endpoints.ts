import { http } from './api'
import type {
  AuthPayload,
  Contest,
  ContestEntry,
  HealthResponse,
  MeResponse,
  Role,
  Room,
  RoomState,
  User,
} from '@/types'

/**
 * Every backend call the app makes, in one place. Keeping them here means a
 * contract change touches exactly one file, and React Query hooks stay thin.
 */

/* -------------------------------------------------------------- auth ---- */

export function login(body: { email: string; password: string }) {
  return http.post<AuthPayload>('/auth/login', body)
}

export function register(body: {
  username: string
  email: string
  password: string
  role?: Role
}) {
  return http.post<AuthPayload>('/auth/register', body)
}

/** `/auth/me` returns `userId`, not `id` — normalize so the app sees one shape. */
export async function me(): Promise<User> {
  const raw = await http.get<MeResponse>('/auth/me')
  return {
    id: raw.userId,
    username: raw.username,
    email: raw.email,
    role: raw.role,
  }
}

export function health() {
  return http.get<HealthResponse>('/health')
}

/* ------------------------------------------------------------- users ---- */

export function getUserById(id: string) {
  return http.get<User>(`/users/${id}`)
}

export function uploadAvatar(id: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  // Let the browser set the multipart boundary; overriding Content-Type breaks it.
  return http.post<User>(`/users/${id}/avatar`, form, {
    headers: { 'Content-Type': undefined },
  })
}

/* ------------------------------------------------------------- rooms ---- */

export function createRoom(title: string) {
  return http.post<Room>('/rooms', { title })
}

export function getRoom(id: string) {
  return http.get<Room>(`/rooms/${id}`)
}

export function joinRoomByCode(code: string) {
  return http.post<Room>(`/rooms/${code.toUpperCase()}/join`)
}

export function setRoomState(id: string, state: RoomState) {
  return http.patch<Room>(`/rooms/${id}/state`, { state })
}

export function pinQuestion(id: string, question: string) {
  return http.patch<Room>(`/rooms/${id}/pin`, { question })
}

export function unpinQuestion(id: string) {
  return http.patch<Room>(`/rooms/${id}/unpin`)
}

/* ---------------------------------------------------------- contests ---- */

export function createContest(title: string) {
  return http.post<Contest>('/contests', { title })
}

export function getContest(id: string) {
  return http.get<Contest>(`/contests/${id}`)
}

export function getContestResults(id: string) {
  return http.get<ContestEntry[]>(`/contests/${id}/results`)
}

export function activateContest(id: string) {
  return http.post<Contest>(`/contests/${id}/activate`)
}

export function joinContest(id: string) {
  return http.post<ContestEntry>(`/contests/${id}/join`)
}

export function scoreContestant(id: string, userId: string, delta: number) {
  return http.post<{ userId: string; score: number }>(`/contests/${id}/score`, {
    userId,
    delta,
  })
}

export function endContest(id: string) {
  return http.post<Contest>(`/contests/${id}/end`)
}