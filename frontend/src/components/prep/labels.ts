// Prep's words and limits. Mirrors src/prep/prep.constants.ts.
import type { PracticeLevel } from '@/types'
import { LEVEL_LABEL } from '@/components/practice/labels'

export const OWN_TOPIC_MAX = 60

/** Topics a coding exercise fits, in a language the editor can run. SQL,
 *  web basics and the candidate's own topics get none. */
export const CODING_TOPICS = ['JavaScript', 'TypeScript', 'Python', 'React', 'Node.js', 'Data structures', 'Algorithms']
/** Letters, numbers, spaces and simple punctuation, as the server allows. */
export const OWN_TOPIC_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} .,+#&/()'-]*$/u

export const drillTitle = (d: { topic: string; level: PracticeLevel }) => `${d.topic} · ${LEVEL_LABEL[d.level]} drill`

/** "41%" */
export const percent = (n: number) => `${Math.round(n * 100)}%`

/** What a refused start means, by the server's error code. */
export const PREP_REFUSED: Record<string, { title: string; detail: string }> = {
  PrepDayUsed: {
    title: "You've used today's sessions of this kind",
    detail: 'More at midnight UTC. Your results stay below.',
  },
  PrepNoQuestions: {
    title: 'No new questions right now',
    detail: "You've seen every saved question on this topic and level, and new ones can't be written just now. Try another level or topic.",
  },
  PrepCoachOff: {
    title: "The coach isn't set up on this server",
    detail: 'An administrator needs to add an AI key. See guides/prep.md. Drills from the question bank still work.',
  },
  PrepCoachBusy: {
    title: 'Coach sessions are full right now',
    detail: "We only start a session when there's room to finish it. Try again in a few minutes. Drills still work.",
  },
  PrepCoachDayFull: {
    title: "Today's coach sessions are used up",
    detail: 'The free AI service has a daily limit. Try again tomorrow. Drills still work.',
  },
}
