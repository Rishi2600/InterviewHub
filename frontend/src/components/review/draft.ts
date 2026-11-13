import type { PracticeKind } from '@/types'

export const NOTE_CHARS = 1000
export const MAX_TOPICS = 3

export interface ReviewDraft {
  kind: PracticeKind
  topics: string[]
  /** Area name to score; missing means "not seen". */
  scores: Record<string, number>
  note: string
}

export const emptyDraft = (): ReviewDraft => ({ kind: 'technical', topics: [], scores: {}, note: '' })

/** Why it can't be saved yet: it needs a topic and a rated area. */
export const draftProblem = (d: ReviewDraft) =>
  d.topics.length === 0 ? 'Pick at least one topic' : Object.keys(d.scores).length === 0 ? 'Rate at least one area' : null
