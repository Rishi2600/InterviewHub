import { Types } from 'mongoose';
import { PracticeInterview } from '../practice/schemas/practice-interview.schema';
import { PrepDrill } from './schemas/prep-drill.schema';
import { PrepQuestion } from './schemas/prep-question.schema';

type Stored<T> = T & { _id: Types.ObjectId };

/**
 * A drill for its owner: answered questions with the right option and the
 * explanation, then the current one without them. Later questions aren't
 * sent at all.
 */
export function drillView(
  drill: Stored<PrepDrill>,
  questions: Map<string, Stored<PrepQuestion>>,
) {
  const shown = drill.status === 'done' ? drill.answered : drill.answered + 1;
  return {
    id: drill._id.toString(),
    topic: drill.topic,
    level: drill.level,
    status: drill.status,
    total: drill.items.length,
    answered: drill.answered,
    right: drill.right,
    startedAt: drill.startedAt,
    endedAt: drill.endedAt,
    items: drill.items.slice(0, shown).map((item) => {
      const q = questions.get(item.questionId.toString());
      const base = {
        questionId: item.questionId.toString(),
        prompt: q?.prompt ?? 'This question is no longer available.',
        code: q?.code ?? null,
        options: q?.options.map((o) => ({ id: o.id, text: o.text })) ?? [],
      };
      if (item.chosen === null) return base;
      return {
        ...base,
        chosen: item.chosen,
        correct: item.correct,
        correctOptionId: q?.correct ?? null,
        explanation: q?.explanation ?? '',
        flagged: item.flagged,
      };
    }),
  };
}

/** One row of the drills and coach sessions list. */
export function drillListItem(drill: Stored<PrepDrill>) {
  return {
    id: drill._id.toString(),
    mode: 'drill' as const,
    topic: drill.topic,
    level: drill.level,
    status: drill.status,
    startedAt: drill.startedAt,
    answered: drill.answered,
    right: drill.right,
    total: drill.items.length,
  };
}

/** One coach session in the same list. Its recap opens like practice feedback. */
export function coachListItem(s: Stored<PracticeInterview>) {
  return {
    id: s._id.toString(),
    mode: 'coach' as const,
    topic: s.topic,
    level: s.level,
    status: s.status,
    startedAt: s.startedAt,
    score: s.score,
  };
}
