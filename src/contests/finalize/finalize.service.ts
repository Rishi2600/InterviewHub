import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, Model, Types } from 'mongoose';
import { Contest, ContestDocument } from '../schemas/contest.schema';
import { ContestEntry } from '../schemas/contest-entry.schema';
import { ContestQuestion } from '../schemas/contest-question.schema';
import { ActivityEvent } from '../../activity/schemas/activity-event.schema';
import { LIMITS } from '../../common/validation/limits';
import { rank, scoreAnswers, Scored, timeUsedMs } from './scoring';

// How long a claim lasts. Far longer than a finalize takes; if the server
// holding it dies, another one takes over once it runs out.
export const LEASE_MS = 5 * 60_000;
// Contests one run finalizes at most; the next run takes the rest.
const MAX_PER_RUN = 20;
const BATCH = 1_000;

export interface FinalizeRun {
  finalized: string[];
  failed: string[];
}

/**
 * Scores, ranks and closes contests whose end has passed. Every server runs
 * this every minute (see FinalizeJob); a lease on each contest makes sure
 * only one does the work, and every step is safe to repeat if a lease runs
 * out part-way. See docs/learning/nestjs-schedule/.
 */
@Injectable()
export class FinalizeService {
  private readonly logger = new Logger(FinalizeService.name);

  constructor(
    @InjectModel(Contest.name)
    private readonly contestModel: Model<ContestDocument>,
    @InjectModel(ContestEntry.name)
    private readonly entryModel: Model<ContestEntry>,
    @InjectModel(ContestQuestion.name)
    private readonly questionModel: Model<ContestQuestion>,
    @InjectModel(ActivityEvent.name)
    private readonly eventModel: Model<ActivityEvent>,
  ) {}

  /** Claims and finalizes due contests, one at a time, until none are left. */
  async finalizeDue(now: Date): Promise<FinalizeRun> {
    const run: FinalizeRun = { finalized: [], failed: [] };
    const started = Date.now();
    for (let i = 0; i < MAX_PER_RUN; i++) {
      const contest = await this.claim(now);
      if (!contest) break;
      const id = contest._id.toString();
      try {
        if (await this.finalizeOne(contest, now)) run.finalized.push(id);
        else run.failed.push(id);
      } catch (err) {
        // The lease runs out and a later run tries again.
        run.failed.push(id);
        this.logger.error(
          { err, contestId: id },
          'Contest finalize failed; it will be retried',
        );
      }
    }
    if (run.finalized.length || run.failed.length) {
      this.logger.log(
        { ...run, ms: Date.now() - started },
        'Finalize run finished',
      );
    }
    return run;
  }

  /**
   * One atomic update: the first server to match a due contest sets the
   * lease and gets it back; any other gets null.
   */
  claim(now: Date): Promise<ContestDocument | null> {
    return this.contestModel
      .findOneAndUpdate(
        {
          status: 'published',
          endAt: { $lte: now },
          finalizedAt: null,
          $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
        },
        { $set: { lockedUntil: new Date(now.getTime() + LEASE_MS) } },
        { new: true, sort: { endAt: 1 } },
      )
      .exec();
  }

  /** Returns false if the lease was lost before the end, so another run
   *  owns the contest now. */
  private async finalizeOne(
    contest: ContestDocument,
    now: Date,
  ): Promise<boolean> {
    const startAt = contest.startAt!;
    const endAt = contest.endAt!;
    const questions = await this.questionModel
      .find({ contestId: contest._id })
      .select('points correctOptionIds')
      .lean()
      .exec();
    const key = questions.map((q) => ({
      id: q._id.toString(),
      points: q.points,
      correctOptionIds: q.correctOptionIds,
    }));
    const answered = new Map<string, number>();
    const correct = new Map<string, number>();

    // 1. Score every entrant who started, streaming the entries.
    const scored: (Scored & {
      userId: Types.ObjectId;
      auto: boolean;
    })[] = [];
    const cursor = this.entryModel
      .find({ contestId: contest._id, startedAt: { $ne: null } })
      .select('userId joinedAt submittedAt autoSubmitted answers')
      .lean()
      .cursor();
    for await (const entry of cursor) {
      // An entry submitted by the clock on an earlier, interrupted run
      // already has submittedAt = endAt; it is still auto-submitted.
      const auto = entry.autoSubmitted || !entry.submittedAt;
      const result = scoreAnswers(
        entry.answers.map((a) => ({
          questionId: a.questionId.toString(),
          optionIds: a.optionIds,
        })),
        key,
      );
      for (const q of result.answered)
        answered.set(q, (answered.get(q) ?? 0) + 1);
      for (const q of result.correct) correct.set(q, (correct.get(q) ?? 0) + 1);
      scored.push({
        id: entry._id.toString(),
        userId: entry.userId,
        auto,
        score: result.score,
        timeUsedMs: timeUsedMs(
          { startAt, endAt },
          {
            joinedAt: entry.joinedAt,
            submittedAt: auto ? null : entry.submittedAt,
          },
        ),
      });
    }

    // 2. Rank, then write results. Everything is overwritten, never added
    //    to, so a second run gives the same result.
    const ranked = rank(scored);
    const starters = ranked.length;
    const rated = starters >= LIMITS.contest.ratedMinStarters;
    const byId = new Map(scored.map((s) => [s.id, s]));

    const entryOps: AnyBulkWriteOperation<ContestEntry>[] = ranked.map((r) => {
      const auto = byId.get(r.id)!.auto;
      return {
        updateOne: {
          filter: { _id: new Types.ObjectId(r.id) },
          update: {
            $set: {
              score: r.score,
              timeUsedMs: r.timeUsedMs,
              rank: r.rank,
              percentile: r.percentile,
              ...(auto && { submittedAt: endAt, autoSubmitted: true }),
            },
          },
        },
      };
    });
    await this.inBatches(entryOps, (ops) => this.entryModel.bulkWrite(ops));

    if (questions.length > 0) {
      await this.questionModel.bulkWrite(
        questions.map((q) => {
          const id = q._id.toString();
          return {
            updateOne: {
              filter: { _id: q._id },
              update: {
                $set: {
                  answeredCount: answered.get(id) ?? 0,
                  correctCount: correct.get(id) ?? 0,
                },
              },
            },
          };
        }),
      );
    }

    // 3. One activity event per starter. The unique index makes a repeat
    //    land on the same row.
    const eventOps: AnyBulkWriteOperation<ActivityEvent>[] = ranked.map((r) => {
      const s = byId.get(r.id)!;
      return {
        updateOne: {
          filter: { kind: 'contest', refId: contest._id, userId: s.userId },
          update: {
            $set: {
              at: endAt,
              data: {
                score: r.score,
                totalPoints: contest.totalPoints,
                rank: r.rank,
                percentile: r.percentile,
                starters,
                rated,
                submitted: !s.auto,
              },
            },
          },
          upsert: true,
        },
      };
    });
    await this.inBatches(eventOps, (ops) => this.eventModel.bulkWrite(ops));

    // 4. Close the contest, but only while this run still holds the lease.
    const closed = await this.contestModel
      .updateOne(
        { _id: contest._id, lockedUntil: contest.lockedUntil },
        {
          $set: {
            finalizedAt: now,
            rated,
            lockedUntil: null,
            startedCount: starters,
            submittedCount: starters,
          },
        },
      )
      .exec();
    if (closed.modifiedCount === 0) {
      this.logger.warn(
        { contestId: contest._id.toString() },
        'Finalize lease lost; another run owns this contest',
      );
      return false;
    }
    return true;
  }

  private async inBatches<T>(
    ops: T[],
    write: (batch: T[]) => Promise<unknown>,
  ): Promise<void> {
    for (let i = 0; i < ops.length; i += BATCH) {
      await write(ops.slice(i, i + BATCH));
    }
  }
}
