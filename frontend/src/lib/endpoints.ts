import { http } from './api'
import type { CodeLanguage } from './sandbox/types'
import type {
  AuthPayload,
  BoardRow,
  BrowsePage,
  BrowsePhase,
  Contest,
  ContestDetails,
  ContestFormat,
  ContestResults,
  ContestStatus,
  EditorQuestion,
  EditorView,
  HealthResponse,
  MeResponse,
  Page,
  PublicUser,
  Role,
  Room,
  RoomReview,
  RoomReviews,
  RoomState,
  SaveReviewBody,
  Submission,
  User,
  UserActivity,
  UserScore,
  ContestHistoryItem,
  Workspace,
  PracticeInterview,
  PracticeOverview,
  StartPracticeBody,
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

/** Ends this device's session on the server and clears the refresh cookie. */
export function logout() {
  return http.post<Record<string, never>>('/auth/logout')
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
  return http.get<PublicUser>(`/users/${id}`)
}

export function uploadAvatar(id: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  // Let the browser set the multipart boundary; overriding Content-Type breaks it.
  return http.post<User>(`/users/${id}/avatar`, form, {
    headers: { 'Content-Type': undefined },
  })
}

export function getUserScore(id: string) {
  return http.get<UserScore>(`/users/${id}/score`)
}

/** The last 12 months, or one calendar year. */
export function getUserActivity(id: string, year?: number) {
  return http.get<UserActivity>(`/users/${id}/activity`, { params: { year } })
}

export function getUserContests(id: string, cursor?: string, limit = 10) {
  return http.get<Page<ContestHistoryItem>>(`/users/${id}/contests`, { params: { cursor, limit } })
}

/* ------------------------------------------------------------- rooms ---- */

export function createRoom(title: string) {
  return http.post<Room>('/rooms', { title })
}

export interface ListParams<S> {
  state?: S
  cursor?: string
  limit?: number
}

/** Rooms the current user owns or has joined, one page at a time. */
export function listRooms(params: ListParams<RoomState> = {}) {
  return http.get<Page<Room>>('/rooms', { params })
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

/* ------------------------------------------------------- reviews ---- */

export function getRoomReviews(roomId: string) {
  return http.get<RoomReviews>(`/reviews/rooms/${roomId}`)
}

export function saveRoomReview(roomId: string, candidateId: string, body: SaveReviewBody) {
  return http.put<RoomReview>(`/reviews/rooms/${roomId}/${candidateId}`, body)
}

export function getMyReviews() {
  return http.get<RoomReview[]>('/reviews/mine')
}

export function pinQuestion(id: string, question: string) {
  return http.patch<Room>(`/rooms/${id}/pin`, { question })
}

export function unpinQuestion(id: string) {
  return http.patch<Room>(`/rooms/${id}/unpin`)
}

/** STUN and short-lived TURN details for a room's call. */
export function getIceServers(id: string) {
  return http.get<{ iceServers: RTCIceServer[]; ttlSeconds: number }>(`/rooms/${id}/ice-servers`)
}

/* ---------------------------------------------------------- contests ---- */

/** Contests the current user hosts or has joined, one page at a time. */
export function listContests(params: { status?: ContestStatus; cursor?: string; limit?: number } = {}) {
  return http.get<Page<Contest>>('/contests', { params })
}

/** The public browse list: works signed out too. */
export function browseContests(params: { phase: BrowsePhase; q?: string; cursor?: string; limit?: number }) {
  return http.get<BrowsePage>('/contests/browse', { params })
}

export function getContestDetails(id: string) {
  return http.get<ContestDetails>(`/contests/${id}`)
}

// Host side

export function createContest(title: string, format: ContestFormat = 'quiz') {
  return http.post<Contest>('/contests', { title, format })
}

export function getContestEditor(id: string) {
  return http.get<EditorView>(`/contests/${id}/editor`)
}

export interface ContestDetailsInput {
  title?: string
  description?: string
  startAt?: string | null
  durationMinutes?: number
  capacity?: number | null
}

export function updateContest(id: string, body: ContestDetailsInput) {
  return http.patch<Contest>(`/contests/${id}`, body)
}

export function saveContestQuestions(id: string, questions: EditorQuestion[]) {
  // The server assigns ids; send only what the editor owns.
  const body = questions.map((q) =>
    q.kind === 'code'
      ? {
          kind: q.kind,
          prompt: q.prompt,
          points: q.points,
          explanation: q.explanation,
          title: q.title,
          starterCode: q.starterCode,
          tests: q.tests,
          timeLimitMs: q.timeLimitMs,
          hostAnswer: q.hostAnswer,
        }
      : {
          kind: q.kind,
          prompt: q.prompt,
          options: q.options,
          correctOptionIds: q.correctOptionIds,
          points: q.points,
          explanation: q.explanation,
        },
  )
  return http.put<EditorQuestion[]>(`/contests/${id}/questions`, { questions: body })
}

export function publishContest(id: string) {
  return http.post<Contest>(`/contests/${id}/publish`)
}

export function cancelContest(id: string) {
  return http.post<Contest>(`/contests/${id}/cancel`)
}

export function deleteContest(id: string) {
  return http.delete<void>(`/contests/${id}`)
}

// Entrant side

export function joinContest(id: string) {
  return http.post<unknown>(`/contests/${id}/join`)
}

export function leaveContest(id: string) {
  return http.post<void>(`/contests/${id}/leave`)
}

/** Opens the workspace; the first call marks the entrant as started. */
export function startContest(id: string) {
  return http.post<Workspace>(`/contests/${id}/start`)
}

export function saveAnswer(id: string, questionId: string, optionIds: string[]) {
  return http.put<{ questionId: string; optionIds: string[] }>(`/contests/${id}/answers/${questionId}`, { optionIds })
}

/** Code contests: autosave the program for one question. */
export function saveCodeDraft(id: string, questionId: string, body: { language: CodeLanguage; code: string }) {
  return http.put<{ questionId: string; savedAt: string }>(`/contests/${id}/drafts/${questionId}`, body)
}

/** Queue a program to be judged against the hidden tests. */
export function submitCode(id: string, questionId: string, body: { language: CodeLanguage; code: string }) {
  return http.post<Submission>(`/contests/${id}/questions/${questionId}/submissions`, body)
}

export function listSubmissions(id: string, questionId: string) {
  return http.get<Submission[]>(`/contests/${id}/questions/${questionId}/submissions`)
}

export function submitContest(id: string) {
  return http.post<{ submittedAt: string }>(`/contests/${id}/submit`)
}

// Results

export function getContestResults(id: string) {
  return http.get<ContestResults>(`/contests/${id}/results`)
}

export function getLeaderboard(id: string, cursor?: string) {
  return http.get<{ items: BoardRow[]; nextCursor: string | null; total: number }>(`/contests/${id}/leaderboard`, {
    params: { cursor, limit: 50 },
  })
}

/* ------------------------------------------------------- AI practice ---- */

/** The practice page: allowance, a running interview and past ones. */
export function getPracticeOverview() {
  return http.get<PracticeOverview>('/practice')
}

export function startPractice(body: StartPracticeBody) {
  return http.post<PracticeInterview>('/practice', body)
}

export function getPractice(id: string) {
  return http.get<PracticeInterview>(`/practice/${id}`)
}

export function endPractice(id: string) {
  return http.post<PracticeInterview>(`/practice/${id}/end`)
}

/** Deletes the feedback for good; the activity square stays. */
export function deletePractice(id: string) {
  return http.delete<void>(`/practice/${id}`)
}
