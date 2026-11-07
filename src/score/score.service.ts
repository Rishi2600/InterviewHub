import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, Model, QueryFilter, Types } from 'mongoose';
import { ActivityEvent } from '../activity/schemas/activity-event.schema';
import { Contest } from '../contests/schemas/contest.schema';
import {
  afterKeyCursor,
  DEFAULT_PAGE_SIZE,
  encodeKeyCursor,
  Page,
  PageQueryDto,
} from '../common/pagination/pagination';
import {
  computeBadges,
  computeScore,
  ContestResult,
  scoreHistory,
  SETTLED_AFTER,
} from './score-formula';
import { UserScore } from './schemas/user-score.schema';

// Users recomputed per database round trip.
const CHUNK = 200;
const DAY_MS = 86_400_000;

export interface ContestHistoryItem {
  contestId: string;
  title: string;
  at: Date;
  rank: number;
  starters: number;
  percentile: number;
  points: number;
  totalPoints: number;
  submitted: boolean;
  rated: boolean;
  // Score after this contest and the change it made; null when unrated.
  scoreAfter: number | null;
  change: number | null;
}

/** Reads a contest activity event's data back into a result. */
export function toResult(e: {
  refId: Types.ObjectId;
  at: Date;
  data: Record<string, unknown>;
}): ContestResult {
  const d = e.data;
  return {
    contestId: e.refId.toString(),
    at: e.at,
    rated: d.rated === true,
    rank: Number(d.rank),
    percentile: Number(d.percentile),
    starters: Number(d.starters),
    submitted: d.submitted === true,
  };
}

const utcDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * Works out and serves candidate scores. Recomputing reads every contest
 * event a user has and overwrites their score document, so it is safe to
 * repeat, which the finalize job relies on.
 */
@Injectable()
export class ScoreService {
  constructor(
    @InjectModel(UserScore.name)
    private readonly scoreModel: Model<UserScore>,
    @InjectModel(ActivityEvent.name)
    private readonly eventModel: Model<ActivityEvent>,
    @InjectModel(Contest.name)
    private readonly contestModel: Model<Contest>,
  ) {}

  async recomputeFor(userIds: Types.ObjectId[], now: Date): Promise<void> {
    for (let i = 0; i < userIds.length; i += CHUNK) {
      const chunk = userIds.slice(i, i + CHUNK);
      const events = await this.eventModel
        .find({ kind: 'contest', userId: { $in: chunk } })
        .select('userId refId at data')
        .sort({ at: 1, refId: 1 })
        .lean()
        .exec();
      const byUser = new Map<string, ContestResult[]>();
      for (const e of events) {
        const key = e.userId.toString();
        if (!byUser.has(key)) byUser.set(key, []);
        byUser.get(key)!.push(toResult(e));
      }
      const ops: AnyBulkWriteOperation<UserScore>[] = chunk.map((userId) => ({
        updateOne: {
          filter: { userId },
          update: {
            $set: this.build(byUser.get(userId.toString()) ?? [], now),
          },
          upsert: true,
        },
      }));
      if (ops.length) await this.scoreModel.bulkWrite(ops);
    }
  }

  private build(results: ContestResult[], now: Date) {
    const rated = results.filter((r) => r.rated);
    const s = computeScore(rated);
    return {
      score: s?.score ?? null,
      provisional: rated.length < SETTLED_AFTER,
      formula: s && {
        weightedSum: s.weightedSum,
        weightTotal: s.weightTotal,
        multiplier: s.multiplier,
        submitted: s.submitted,
        window: s.window,
      },
      ratedCount: rated.length,
      enteredCount: results.length,
      lastActiveAt: results.at(-1)?.at ?? null,
      history: scoreHistory(rated).map((p) => ({
        ...p,
        contestId: new Types.ObjectId(p.contestId),
      })),
      badges: computeBadges(results),
      computedAt: now,
    };
  }

  /** The score section. Only the candidate sees badges they have not earned. */
  async getScore(userId: Types.ObjectId, includeLocked: boolean) {
    const doc = await this.scoreModel.findOne({ userId }).lean().exec();
    const badges = doc?.badges ?? computeBadges([]);
    return {
      score: doc?.score ?? null,
      provisional: doc?.provisional ?? true,
      formula: doc?.formula ?? null,
      ratedCount: doc?.ratedCount ?? 0,
      enteredCount: doc?.enteredCount ?? 0,
      lastActiveAt: doc?.lastActiveAt ?? null,
      history: (doc?.history ?? []).map((p) => ({
        contestId: p.contestId.toString(),
        at: p.at,
        score: p.score,
      })),
      badges: badges
        .filter((b) => includeLocked || b.count > 0)
        .map(({ id, count, earnedAt, progress, goal }) => ({
          id,
          count,
          earnedAt,
          progress,
          goal,
        })),
    };
  }

  /**
   * Activity per UTC day for the contribution graph: the last 12 months, or
   * one calendar year. Every kind of event counts, so interviews and prep
   * add squares once they write events.
   */
  async activity(
    userId: Types.ObjectId,
    joinedAt: Date,
    now: Date,
    year?: number,
  ) {
    const today = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    const from = year ? Date.UTC(year, 0, 1) : today - 364 * DAY_MS;
    const to = year ? Math.min(today, Date.UTC(year, 11, 31)) : today;
    const days = await this.eventModel
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            userId,
            at: { $gte: new Date(from), $lt: new Date(to + DAY_MS) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$at' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .exec();
    const years: number[] = [];
    for (let y = now.getUTCFullYear(); y >= joinedAt.getUTCFullYear(); y--)
      years.push(y);
    return {
      from: utcDay(from),
      to: utcDay(Math.max(from, to)),
      days: days.map((d) => ({ date: d._id, count: d.count })),
      total: days.reduce((sum, d) => sum + d.count, 0),
      years,
    };
  }

  /** Contests the user started, newest first, with the score after each. */
  async contestHistory(
    userId: Types.ObjectId,
    query: PageQueryDto,
  ): Promise<Page<ContestHistoryItem>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const scope = { userId, kind: 'contest' as const };
    const filter: QueryFilter<ActivityEvent> = query.cursor
      ? { $and: [scope, afterKeyCursor('at', query.cursor, -1)] }
      : scope;
    const [rows, total, score] = await Promise.all([
      this.eventModel
        .find(filter)
        .select('refId at data')
        .sort({ at: -1, _id: -1 })
        .limit(limit + 1)
        .lean()
        .exec(),
      this.eventModel.countDocuments(scope).exec(),
      this.scoreModel.findOne({ userId }).select('history').lean().exec(),
    ]);
    const page = rows.slice(0, limit);
    const contests = await this.contestModel
      .find({ _id: { $in: page.map((e) => e.refId) } })
      .select('title')
      .lean()
      .exec();
    const titles = new Map(contests.map((c) => [c._id.toString(), c.title]));
    const history = score?.history ?? [];
    const after = new Map(
      history.map((p, i) => [
        p.contestId.toString(),
        { score: p.score, change: i ? p.score - history[i - 1].score : null },
      ]),
    );
    const items = page.map((e) => {
      const r = toResult(e);
      const point = after.get(r.contestId);
      return {
        contestId: r.contestId,
        title: titles.get(r.contestId) ?? 'Deleted contest',
        at: r.at,
        rank: r.rank,
        starters: r.starters,
        percentile: r.percentile,
        points: Number(e.data.score),
        totalPoints: Number(e.data.totalPoints),
        submitted: r.submitted,
        rated: r.rated,
        scoreAfter: point?.score ?? null,
        change: point?.change ?? null,
      };
    });
    const last = page.at(-1);
    return {
      items,
      nextCursor:
        rows.length > limit && last ? encodeKeyCursor(last.at, last._id) : null,
      counts: { total },
    };
  }
}
