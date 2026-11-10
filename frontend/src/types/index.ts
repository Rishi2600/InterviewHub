/**
 * Shapes returned by the InterviewHub backend.
 *
 * These mirror the Nest DTOs/schemas one-for-one — if the backend changes,
 * this file is the single place the frontend needs to follow.
 */

import type { CodeLanguage, TestVerdict } from '@/lib/sandbox/types'

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

/** Another user as the API shows them: the email only to themselves and admins. */
export type PublicUser = Omit<User, 'email'> & { email?: string }

/** One page of a list, newest first. Send `nextCursor` back for the next
 *  page; null means no more. `counts` are totals per state for the whole list. */
export interface Page<T> {
  items: T[]
  nextCursor: string | null
  counts: Record<string, number>
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

/* ---------------------------------------------------------- contests ---- */

export type ContestStatus = 'draft' | 'published' | 'cancelled'

/** Chosen when the draft is created; the two never mix. */
export type ContestFormat = 'quiz' | 'code'

/** Where a contest is, worked out by the server from the clock. `pending`:
 *  it has ended but results are not out yet. */
export type ContestPhase = 'draft' | 'cancelled' | 'upcoming' | 'live' | 'pending' | 'ended'

/** A contest as stored: what lists of your own contests and the editor get. */
export interface Contest {
  _id: string
  format: ContestFormat
  title: string
  description: string
  hostId: string
  hostName: string
  status: ContestStatus
  startAt: string | null
  endAt: string | null
  durationMinutes: number | null
  capacity: number | null
  questionCount: number
  totalPoints: number
  entrantCount: number
  startedCount: number
  submittedCount: number
  publishedAt: string | null
  cancelledAt: string | null
  finalizedAt: string | null
  rated: boolean | null
  createdAt: string
}

/** A browse card. Signed-in viewers also get `viewer`. */
export interface ContestCard {
  _id: string
  format: ContestFormat
  title: string
  hostName: string
  phase: ContestPhase
  startAt: string | null
  endAt: string | null
  durationMinutes: number | null
  questionCount: number
  capacity: number | null
  entrantCount: number
  startedCount: number
  submittedCount: number
  rated: boolean | null
  viewer?: { hosting: boolean; joined: boolean; rank: number | null }
}

export interface BrowsePage {
  items: ContestCard[]
  nextCursor: string | null
  total: number
}

export type BrowsePhase = 'live' | 'upcoming' | 'past'

export interface BoardRow {
  _id: string
  userId: string
  username: string
  rank: number
  score: number
  timeUsedMs: number
  autoSubmitted: boolean
}

/** The details page. Never carries questions or answers. */
export interface ContestDetails extends Omit<ContestCard, 'viewer'> {
  description: string
  totalPoints: number
  status: ContestStatus
  cancelledAt: string | null
  viewer: {
    hosting: boolean
    // The host or an admin: offered edit and cancel.
    canManage: boolean
    entry: {
      joinedAt: string
      startedAt: string | null
      submittedAt: string | null
      answered: number
      score: number | null
      rank: number | null
      percentile: number | null
      timeUsedMs: number | null
    } | null
  }
  top: Pick<BoardRow, 'username' | 'rank' | 'score' | 'timeUsedMs'>[]
}

export type QuestionKind = 'single' | 'multiple' | 'code'

export interface QuestionOption {
  id: string
  text: string
}

/** One test of a code question. Visible tests are shown as examples;
 *  hidden ones never leave the server. */
export interface CodeTest {
  input: string
  output: string
  visible: boolean
}

export type StarterCode = Record<CodeLanguage, string>

/** A question as the host edits it, answer key included. Code questions use
 *  the title, starter code, tests, time limit and the host's own answer. */
export interface EditorQuestion {
  _id?: string
  kind: QuestionKind
  prompt: string
  options: QuestionOption[]
  correctOptionIds: string[]
  points: number
  explanation: string
  title: string
  starterCode: StarterCode
  tests: CodeTest[]
  timeLimitMs: number
  hostAnswer: { language: CodeLanguage; code: string } | null
}

export interface PublishCheck {
  label: string
  ok: boolean
  detail?: string
}

export interface EditorView {
  contest: Contest
  questions: EditorQuestion[]
  checks: PublishCheck[]
  // Null for admins, who have no limit.
  usage: { used: number; limit: number; resetsAt: string } | null
}

/** What the workspace gets: questions in this entrant's own order, without
 *  the answer key. */
export interface Workspace {
  contest: {
    _id: string
    format: ContestFormat
    title: string
    startAt: string
    endAt: string
    questionCount: number
    totalPoints: number
  }
  serverNow: string
  entry: { joinedAt: string; startedAt: string | null; submittedAt: string | null }
  // Quiz questions in this entrant's own order, or code questions in the
  // host's order.
  questions: (QuizQuestionView | CodeQuestionView)[]
  answers: Record<string, string[]>
  // Code contests: the saved draft and newest submission per question.
  drafts: Record<string, { language: CodeLanguage; code: string; savedAt: string }>
  latest: Record<string, Submission>
}

export interface QuizQuestionView {
  _id: string
  kind: 'single' | 'multiple'
  prompt: string
  points: number
  options: QuestionOption[]
}

/** A code question as an entrant sees it: no hidden tests, no host answer. */
export interface CodeQuestionView {
  _id: string
  kind: 'code'
  title: string
  prompt: string
  points: number
  timeLimitMs: number
  starterCode: StarterCode
  examples: { input: string; output: string }[]
  hiddenCount: number
}

export type SubmissionStatus = 'queued' | 'running' | 'done' | 'failed'

/** One Submit: a verdict and time per hidden test, never the test itself. */
export interface Submission {
  _id: string
  questionId: string
  language: CodeLanguage
  status: SubmissionStatus
  verdicts: { verdict: TestVerdict; ms: number }[]
  passed: number
  total: number
  points: number
  createdAt: string
}

export interface ResultQuestion {
  _id: string
  number: number
  kind: 'single' | 'multiple'
  prompt: string
  points: number
  options: QuestionOption[]
  correctOptionIds: string[]
  explanation: string
  // Null when the viewer did not enter or skipped it.
  picked: string[] | null
  earned: number
  // Host and admins only.
  answeredCount?: number
  correctCount?: number
}

/** A code question after the end: examples, and the viewer's submission
 *  that counted. Hidden tests stay hidden. */
export interface CodeResultQuestion {
  _id: string
  number: number
  kind: 'code'
  title: string
  prompt: string
  points: number
  explanation: string
  examples: { input: string; output: string }[]
  hiddenCount: number
  submission: {
    language: CodeLanguage
    code: string
    verdicts: { verdict: TestVerdict; ms: number }[]
    passed: number
    total: number
    createdAt: string
  } | null
  earned: number
  answeredCount?: number
  correctCount?: number
}

export interface ContestResults {
  contest: {
    _id: string
    format: ContestFormat
    title: string
    hostName: string
    endAt: string
    questionCount: number
    totalPoints: number
    starters: number
    rated: boolean | null
  }
  top: BoardRow[]
  me: { rank: number; score: number; timeUsedMs: number; percentile: number; autoSubmitted: boolean } | null
  questions: (ResultQuestion | CodeResultQuestion)[]
}

export interface ContestCounts {
  contestId: string
  entrantCount: number
  startedCount: number
  submittedCount: number
}

export interface HealthResponse {
  status: 'ok'
  checks: { mongo: 'up' | 'down' | 'disabled'; redis: 'up' | 'down' | 'disabled' }
}

/** Payload of the WebSocket `error` event emitted by WsExceptionsFilter. */
export interface SocketError {
  event: string
  message: string
  timestamp: string
}
/* ------------------------------------------------------------- score ---- */

export type BadgeId = 'first-rated' | 'winner' | 'podium' | 'top-10' | 'finisher' | 'regular' | 'streak'

export interface BadgeState {
  id: BadgeId
  count: number
  earnedAt: string | null
  progress: number
  goal: number
}

/** A candidate's score section. Locked badges come only to the candidate. */
export interface UserScore {
  user: Omit<PublicUser, 'email'> & { joinedAt: string }
  // Null before the first rated contest.
  score: number | null
  provisional: boolean
  formula: { weightedSum: number; weightTotal: number; multiplier: number; submitted: number; window: number } | null
  ratedCount: number
  enteredCount: number
  lastActiveAt: string | null
  history: { contestId: string; at: string; score: number }[]
  badges: BadgeState[]
}

/** Activity per UTC day, only days with something on them. */
export interface UserActivity {
  from: string
  to: string
  days: { date: string; count: number }[]
  total: number
  years: number[]
}

export interface ContestHistoryItem {
  contestId: string
  title: string
  at: string
  rank: number
  starters: number
  percentile: number
  points: number
  totalPoints: number
  submitted: boolean
  rated: boolean
  scoreAfter: number | null
  change: number | null
}
