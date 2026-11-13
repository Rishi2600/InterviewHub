// What the prep sentence is set to, and how one change affects the rest.
import { TOPICS } from '@/components/practice/labels'
import type { PracticeKind, PracticeLevel, PrepMode } from '@/types'
import { OWN_TOPIC_MAX, OWN_TOPIC_PATTERN } from './labels'

export interface PrepChoice {
  mode: PrepMode
  topic: string
  level: PracticeLevel
  /** The topic was typed by the candidate (coach only). */
  own: boolean
  /** An own topic's type. */
  ownKind: PracticeKind
}

export const DEFAULT_CHOICE: PrepChoice = { mode: 'drill', topic: 'SQL', level: 'junior', own: false, ownKind: 'technical' }

/** Drills take only technical topics from the list. */
export function withMode(c: PrepChoice, mode: PrepMode): PrepChoice {
  if (mode === 'drill' && (c.own || !TOPICS.technical.includes(c.topic))) {
    return { ...c, mode, topic: DEFAULT_CHOICE.topic, own: false }
  }
  return { ...c, mode }
}

/** Why an own topic can't be used yet, or null. */
export function ownTopicProblem(text: string): string | null {
  const t = text.trim()
  if (t.length < 2) return 'Type at least 2 characters'
  if (t.length > OWN_TOPIC_MAX) return `At most ${OWN_TOPIC_MAX} characters`
  if (!OWN_TOPIC_PATTERN.test(t)) return 'Letters, numbers, spaces and simple punctuation only'
  return null
}

