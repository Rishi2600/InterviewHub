import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { countedTokens } from '../ai/ai.types';
import { PracticeEngines } from './practice-engines';
import { PracticeNotifier } from './practice.notifier';
import { feedbackAreas, PRACTICE_LIMITS } from './practice.constants';
import { feedbackRequest, overallScore, parseFeedback } from './prompts';
import {
  Feedback,
  PracticeInterview,
} from './schemas/practice-interview.schema';

// How long one server holds an interview while writing its feedback.
const LEASE_MS = 2 * 60_000;
// After a failed try, wait 1, 2, 4... minutes, at most this many.
const MAX_BACKOFF_MINUTES = 30;

/**
 * Writes the feedback for ended interviews: once right after the end, then
 * from the every-minute job until it works or a day has passed. A lease on
 * each interview means only one server writes it; the same field holds when
 * the next try is due.
 */
@Injectable()
export class PracticeFeedbackService {
  private readonly logger = new Logger(PracticeFeedbackService.name);

  constructor(
    @InjectModel(PracticeInterview.name)
    private readonly model: Model<PracticeInterview>,
    private readonly engines: PracticeEngines,
    private readonly notifier: PracticeNotifier,
  ) {}

  /** Tries to write one interview's feedback. True when it was written. */
  async write(id: string | Types.ObjectId, now = new Date()): Promise<boolean> {
    const iv = await this.model
      .findOneAndUpdate(
        {
          _id: id,
          status: 'ended',
          $or: [
            { feedbackLeaseUntil: null },
            { feedbackLeaseUntil: { $lt: now } },
          ],
        },
        {
          $set: { feedbackLeaseUntil: new Date(now.getTime() + LEASE_MS) },
          $inc: { feedbackTries: 1 },
        },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();
    if (!iv) return false;

    let feedback: Feedback;
    let tokens = 0;
    const { ai, budget } = this.engines.for(iv);
    try {
      const result = await ai.chat(feedbackRequest(iv));
      tokens = countedTokens(result.usage);
      await budget.spent(iv.quota, tokens);
      feedback = parseFeedback(
        result.text,
        feedbackAreas(iv.kind, !!iv.language),
      );
    } catch (err) {
      this.logger.warn(
        `Feedback for ${iv._id.toString()} failed (try ${iv.feedbackTries}): ${(err as Error).message}`,
      );
      const minutes = Math.min(
        MAX_BACKOFF_MINUTES,
        2 ** (iv.feedbackTries - 1),
      );
      await this.model
        .updateOne(
          { _id: iv._id, status: 'ended' },
          {
            $set: {
              feedbackLeaseUntil: new Date(now.getTime() + minutes * 60_000),
            },
            $inc: { usedRequests: tokens ? 1 : 0, usedTokens: tokens },
          },
        )
        .exec();
      return false;
    }

    const done = await this.model
      .findOneAndUpdate(
        { _id: iv._id, status: 'ended' },
        {
          $set: {
            status: 'done',
            feedback,
            score: overallScore(feedback),
            turns: [],
            codingQuestion: null,
            feedbackLeaseUntil: null,
          },
          $inc: { usedRequests: 1, usedTokens: tokens },
        },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();
    // Deleted by the candidate while it was being written.
    if (!done) return false;
    await budget.settle(done.quota, {
      requests: done.usedRequests,
      tokens: done.usedTokens,
    });
    this.notifier.emit(done._id.toString(), 'practice:feedback', {
      id: done._id.toString(),
      status: 'done',
      score: done.score,
    });
    return true;
  }

  /** Ended interviews whose next feedback try is due, oldest first. */
  async due(now: Date, limit: number): Promise<Types.ObjectId[]> {
    const rows = await this.model
      .find({
        status: 'ended',
        $or: [
          { feedbackLeaseUntil: null },
          { feedbackLeaseUntil: { $lt: now } },
        ],
      })
      .select('_id')
      .sort({ endedAt: 1 })
      .limit(limit)
      .lean()
      .exec();
    return rows.map((r) => r._id);
  }

  /** Feedback still not written a day after the end: stop, delete the chat. */
  async giveUp(now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - PRACTICE_LIMITS.feedbackRetryMs);
    const stale = await this.model
      .find({ status: 'ended', endedAt: { $lt: cutoff } })
      .select('_id')
      .limit(50)
      .lean()
      .exec();
    let failed = 0;
    for (const { _id } of stale) {
      const iv = await this.model
        .findOneAndUpdate(
          { _id, status: 'ended' },
          {
            $set: {
              status: 'failed',
              turns: [],
              codingQuestion: null,
              feedbackLeaseUntil: null,
            },
          },
          { returnDocument: 'after' },
        )
        .lean()
        .exec();
      if (!iv) continue;
      failed++;
      await this.engines.for(iv).budget.settle(iv.quota, {
        requests: iv.usedRequests,
        tokens: iv.usedTokens,
      });
      this.notifier.emit(_id.toString(), 'practice:feedback', {
        id: _id.toString(),
        status: 'failed',
        score: null,
      });
    }
    return failed;
  }
}
