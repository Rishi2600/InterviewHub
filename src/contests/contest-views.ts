import { Types } from 'mongoose';
import type { Contest } from './schemas/contest.schema';
import type { ContestEntry } from './schemas/contest-entry.schema';

/**
 * Where a contest is in its life, worked out from status and the clock.
 * `pending` means it has ended but results are not out yet.
 */
export type ContestPhase =
  'draft' | 'cancelled' | 'upcoming' | 'live' | 'pending' | 'ended';

type ContestFields = Contest & { _id: Types.ObjectId };

export function phaseOf(contest: ContestFields, now: Date): ContestPhase {
  if (contest.status !== 'published') return contest.status;
  if (!contest.startAt || !contest.endAt || now < contest.startAt)
    return 'upcoming';
  if (now < contest.endAt) return 'live';
  return contest.finalizedAt ? 'ended' : 'pending';
}

/** What the signed-in viewer has to do with a contest. */
export interface CardViewer {
  hosting: boolean;
  joined: boolean;
  rank: number | null;
}

/** A browse card. Public: nothing here is secret. */
export function toCard(c: ContestFields, now: Date, viewer: CardViewer | null) {
  return {
    _id: c._id,
    title: c.title,
    format: c.format,
    hostName: c.hostName,
    phase: phaseOf(c, now),
    startAt: c.startAt,
    endAt: c.endAt,
    durationMinutes: c.durationMinutes,
    questionCount: c.questionCount,
    capacity: c.capacity,
    entrantCount: c.entrantCount,
    startedCount: c.startedCount,
    submittedCount: c.submittedCount,
    rated: c.rated,
    ...(viewer && { viewer }),
  };
}

export type ContestCard = ReturnType<typeof toCard>;

type EntryFields = Pick<
  ContestEntry,
  | 'joinedAt'
  | 'startedAt'
  | 'submittedAt'
  | 'answers'
  | 'score'
  | 'rank'
  | 'percentile'
  | 'timeUsedMs'
>;

/** The details page for a signed-in user. Questions and answers are never
 *  part of it; the workspace and results pages serve those. */
export function toDetails(
  c: ContestFields,
  now: Date,
  // canManage: the host or an admin, who get the edit and cancel actions.
  role: { hosting: boolean; canManage: boolean },
  entry: EntryFields | null,
  top: Pick<ContestEntry, 'username' | 'rank' | 'score' | 'timeUsedMs'>[],
) {
  return {
    ...toCard(c, now, null),
    description: c.description,
    totalPoints: c.totalPoints,
    status: c.status,
    cancelledAt: c.cancelledAt,
    viewer: {
      ...role,
      entry: entry && {
        joinedAt: entry.joinedAt,
        startedAt: entry.startedAt,
        submittedAt: entry.submittedAt,
        answered: entry.answers.length,
        score: entry.score,
        rank: entry.rank,
        percentile: entry.percentile,
        timeUsedMs: entry.timeUsedMs,
      },
    },
    // The top of the leaderboard, once results are out.
    top,
  };
}
