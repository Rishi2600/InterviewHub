// AI practice choices and labels. Mirrors src/practice/practice.constants.ts.
import type { CodeLanguage } from '@/lib/sandbox/types'
import type { PracticeKind, PracticeLevel } from '@/types'

export const TOPICS: Record<PracticeKind, string[]> = {
  technical: ['JavaScript', 'TypeScript', 'Python', 'React', 'Node.js', 'SQL', 'Data structures', 'Algorithms', 'Web basics'],
  behavioural: ['Teamwork', 'Conflict', 'Ownership', 'Failure and learning', 'Leadership', 'Deadlines'],
}
/** Picks a topic at random, on the server. */
export const MIXED = 'Mixed'

export const KIND_LABEL: Record<PracticeKind, string> = { technical: 'Technical', behavioural: 'Behavioural' }
export const LEVEL_LABEL: Record<PracticeLevel, string> = { junior: 'Junior', mid: 'Mid', senior: 'Senior' }
export const LEVELS: PracticeLevel[] = ['junior', 'mid', 'senior']
export const MINUTES = [15, 30, 40]

export const ANSWER_CHARS = 2000

/** A topic that is itself a language codes in that language. */
export function languageFor(topic: string): CodeLanguage {
  if (topic === 'JavaScript' || topic === 'Node.js' || topic === 'React') return 'javascript'
  if (topic === 'TypeScript') return 'typescript'
  return 'python'
}

/** "Python · Mid" */
export const practiceTitle = (p: { topic: string; level: PracticeLevel }) => `${p.topic} · ${LEVEL_LABEL[p.level]}`

export const formatScore = (n: number) => n.toFixed(1)

/** What a refused start means, by the server's error code. */
export const START_REFUSED: Record<string, { title: string; detail: string }> = {
  PracticeBusy: {
    title: 'AI interviews are full right now',
    detail: "We only start an interview when there's room to finish it. Try again in a few minutes.",
  },
  PracticeDayFull: {
    title: "Today's AI interviews are used up",
    detail: 'The free AI service has a daily limit. Try again tomorrow.',
  },
  PracticeMonthUsed: {
    title: "You've used this month's interviews",
    detail: 'Your next ones are ready at the start of next month. Your feedback stays below.',
  },
  PracticeOff: {
    title: "AI practice isn't set up on this server",
    detail: 'An administrator needs to add an AI key. See guides/ai-practice.md.',
  },
}
