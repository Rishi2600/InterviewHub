import { answerLimit } from './practice.constants';
import { PracticeInterview, Turn } from './schemas/practice-interview.schema';
import { Types } from 'mongoose';

type Stored = PracticeInterview & { _id: Types.ObjectId };

/** A turn as the candidate sees it: no notes or code meant for the AI. */
export const turnView = (t: Turn) => ({
  kind: t.kind,
  text: t.text,
  at: t.at,
  ...(t.run && { run: t.run }),
});

/** The whole interview, for its owner. */
export function interviewView(iv: Stored) {
  return {
    id: iv._id.toString(),
    purpose: iv.purpose ?? 'interview',
    focus: iv.focus ?? null,
    kind: iv.kind,
    topic: iv.topic,
    mixed: iv.mixed,
    level: iv.level,
    minutes: iv.minutes,
    language: iv.language,
    mode: iv.mode,
    status: iv.status,
    startedAt: iv.startedAt,
    endsAt: iv.endsAt,
    endedAt: iv.endedAt,
    endReason: iv.endReason,
    answers: iv.answers,
    maxAnswers: answerLimit(iv.purpose),
    turns: iv.turns.map(turnView),
    codingQuestion: iv.codingQuestion,
    feedback: iv.feedback,
    score: iv.score,
  };
}

/** One row of the past-interviews list. */
export function listItemView(iv: Stored) {
  return {
    id: iv._id.toString(),
    kind: iv.kind,
    topic: iv.topic,
    mixed: iv.mixed,
    level: iv.level,
    minutes: iv.minutes,
    mode: iv.mode,
    status: iv.status,
    startedAt: iv.startedAt,
    score: iv.score,
  };
}
