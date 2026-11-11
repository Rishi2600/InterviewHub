import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { isDuplicateKey } from '../common/mongo-errors';
import { AiBudget } from './schemas/ai-budget.schema';
import { PRACTICE_LIMITS } from './practice.constants';

/** What one interview set aside from a day's budget. */
export interface Reservation {
  day: string;
  requests: number;
  tokens: number;
}

/** Why an interview can't start: too many running, or today's budget. */
export type Refusal = 'busy' | 'day';

export const utcDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Keeps AI use under the free limits. An interview starts only if a
 * full-length one still fits in today's budget and fewer than
 * AI_MAX_RUNNING are running, so a started interview can always finish.
 */
@Injectable()
export class AiBudgetService {
  readonly dailyRequests: number;
  readonly dailyTokens: number;
  readonly tokensPerInterview: number;
  readonly maxRunning: number;

  constructor(
    @InjectModel(AiBudget.name) private readonly model: Model<AiBudget>,
    config: ConfigService,
  ) {
    this.dailyRequests = Number(config.get('AI_DAILY_REQUESTS'));
    this.dailyTokens = Number(config.get('AI_DAILY_TOKENS'));
    this.tokensPerInterview = Number(config.get('AI_TOKENS_PER_INTERVIEW'));
    this.maxRunning = Number(config.get('AI_MAX_RUNNING'));
  }

  /** Sets aside a full-length interview, in one conditional update. */
  async reserve(now: Date): Promise<Reservation | Refusal> {
    const r: Reservation = {
      day: utcDay(now),
      requests: PRACTICE_LIMITS.requestsPerInterview,
      tokens: this.tokensPerInterview,
    };
    if (r.requests > this.dailyRequests || r.tokens > this.dailyTokens) {
      return 'day';
    }
    const filter = {
      day: r.day,
      running: { $lt: this.maxRunning },
      reservedRequests: { $lte: this.dailyRequests - r.requests },
      reservedTokens: { $lte: this.dailyTokens - r.tokens },
    };
    const inc = {
      $inc: {
        running: 1,
        reservedRequests: r.requests,
        reservedTokens: r.tokens,
      },
    };
    try {
      // No row for today yet: the upsert creates it. A full row: the filter
      // misses, the upsert tries a second row and the unique day refuses it.
      await this.model.updateOne(filter, inc, { upsert: true }).exec();
      return r;
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
    }
    const { modifiedCount } = await this.model.updateOne(filter, inc).exec();
    if (modifiedCount) return r;
    const row = await this.model.findOne({ day: r.day }).lean().exec();
    return row && row.running >= this.maxRunning ? 'busy' : 'day';
  }

  /** The interview stopped running. */
  async stopped(r: Reservation): Promise<void> {
    await this.model
      .updateOne({ day: r.day, running: { $gt: 0 } }, { $inc: { running: -1 } })
      .exec();
  }

  /** One AI call's real use. */
  async spent(r: Reservation, tokens: number): Promise<void> {
    await this.model
      .updateOne(
        { day: r.day },
        { $inc: { usedRequests: 1, usedTokens: tokens } },
        { upsert: true },
      )
      .exec();
  }

  /** Replaces what an interview set aside with what it really used. */
  async settle(
    r: Reservation,
    used: { requests: number; tokens: number },
  ): Promise<void> {
    await this.model
      .updateOne(
        { day: r.day },
        {
          $inc: {
            reservedRequests: used.requests - r.requests,
            reservedTokens: used.tokens - r.tokens,
          },
        },
      )
      .exec();
  }

  /** Today's use against the budget, for admins. */
  async today(now: Date) {
    const day = utcDay(now);
    const row = await this.model.findOne({ day }).lean().exec();
    return {
      day,
      running: row?.running ?? 0,
      maxRunning: this.maxRunning,
      requests: {
        used: row?.usedRequests ?? 0,
        reserved: row?.reservedRequests ?? 0,
        budget: this.dailyRequests,
      },
      tokens: {
        used: row?.usedTokens ?? 0,
        reserved: row?.reservedTokens ?? 0,
        budget: this.dailyTokens,
      },
    };
  }
}
