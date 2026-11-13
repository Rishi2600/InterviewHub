// The words that change when the practice screen runs a prep coach session.
import type { PracticeInterview } from '@/types'

export function sessionWords(purpose: PracticeInterview['purpose'] = 'interview') {
  return purpose === 'coach'
    ? {
        thing: 'session',
        Thing: 'Session',
        ai: 'coach',
        aiName: 'AI coach',
        tag: 'Coach',
        report: 'recap',
        Report: 'Recap',
        home: '/prep',
        homeLabel: 'Prep',
        cancelledNote: "You ended it before answering, so there's no recap, and today's coach session is given back.",
        noAnswerNote: "You haven't answered anything yet, so there's no recap and it won't count toward today.",
      }
    : {
        thing: 'interview',
        Thing: 'Interview',
        ai: 'interviewer',
        aiName: 'AI interviewer',
        tag: 'Practice',
        report: 'feedback',
        Report: 'Feedback',
        home: '/practice',
        homeLabel: 'AI practice',
        cancelledNote: "You ended it before answering, so there's no feedback, and it doesn't count toward this month's interviews.",
        noAnswerNote: "You haven't answered anything yet, so there's no feedback and it won't count toward this month.",
      }
}
