/**
 * Shapes returned by the InterviewHub backend.
 *
 * These mirror the Nest DTOs/schemas one-for-one — if the backend changes,
 * this file is the single place the frontend needs to follow.
 */

export type Role = 'candidate' | 'interviewer' | 'admin'

/** Normalized current user. The backend is inconsistent here — `/auth/login`
 *  returns `user.id` while `/auth/me` returns `userId` — so we normalize both
 *  into this one shape at the API boundary. */
export interface User {
  id: string
  username: string
  email: string
  role: Role
  avatarUrl?: string | null
}

export interface AuthPayload {
  accessToken: string
  user: User
}

/** Raw `/auth/me` response, before normalization. */
export interface MeResponse {
  userId: string
  username: string
  email: string
  role: Role
}

export type RoomState = 'waiting' | 'active' | 'ended'

export interface Participant {
  userId: string
  username: string
  role: Role
  joinedAt: string
}

export interface Room {
  _id: string
  title: string
  code: string
  ownerId: string
  state: RoomState
  participants: Participant[]
  pinnedQuestion: string | null
  createdAt: string
  updatedAt: string
}

export type MessageType = 'user' | 'system'

export interface Message {
  id: string
  roomId: string
  senderId: string | null
  senderName: string
  content: string
  type: MessageType
  createdAt: string
}

export type ContestState = 'draft' | 'active' | 'ended'

export interface Contest {
  _id: string
  title: string
  ownerId: string
  state: ContestState
  endedAt: string | null
  createdAt: string
}

export interface ContestEntry {
  _id: string
  contestId: string
  userId: string
  username: string
  finalScore: number
  finalRank: number
}

/** Live leaderboard row. Note the backend sends no username here — only the
 *  user id — so the UI resolves display names from the contest entry roster. */
export interface LeaderboardRow {
  userId: string
  score: number
  rank: number
}

export interface LeaderboardUpdate {
  contestId: string
  top: LeaderboardRow[]
}

export interface HealthResponse {
  status: string
  service: string
  timestamp: string
}

/** Payload of the WebSocket `error` event emitted by WsExceptionsFilter. */
export interface SocketError {
  event: string
  message: string
  timestamp: string
}