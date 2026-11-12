import { Model } from 'mongoose';
import { isDuplicateKey } from '../common/mongo-errors';
import { AiBudget } from './schemas/ai-budget.schema';

/** What one session or request set aside from a day's budget. */
export interface Reservation {
  day: string;
  requests: number;
  tokens: number;
  /** Counted against the sessions running at once. */
  running: boolean;
}

/** Why it can't start: too many running, or today's budget. */
export type Refusal = 'busy' | 'day';

export interface BudgetLimits {
  dailyRequests: number;
  dailyTokens: number;
  maxRunning: number;
}

export const utcDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Keeps one feature's AI use under the free limits, a row per UTC day.
 * Something starts only if its full share still fits in today's budget (and,
 * for a session, fewer than `maxRunning` are running), so what starts can
 * always finish. Practice and prep each have their own.
 */
export abstract class DailyBudget {
  protected constructor(
    private readonly model: Model<AiBudget>,
    readonly limits: BudgetLimits,
  ) {}

  /** Sets aside `amount`, in one conditional update. */
  protected async take(
    now: Date,
    amount: { requests: number; tokens: number },
    running: boolean,
  ): Promise<Reservation | Refusal> {
    const { dailyRequests, dailyTokens, maxRunning } = this.limits;
    const r: Reservation = { day: utcDay(now), ...amount, running };
    if (r.requests > dailyRequests || r.tokens > dailyTokens) return 'day';
    const filter = {
      day: r.day,
      ...(running ? { running: { $lt: maxRunning } } : {}),
      reservedRequests: { $lte: dailyRequests - r.requests },
      reservedTokens: { $lte: dailyTokens - r.tokens },
    };
    const inc = {
      $inc: {
        running: running ? 1 : 0,
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
    if (!running) return 'day';
    const row = await this.model.findOne({ day: r.day }).lean().exec();
    return row && row.running >= maxRunning ? 'busy' : 'day';
  }

  /** A running session stopped. Only for reservations taken as running. */
  async stopped(r: Pick<Reservation, 'day'>): Promise<void> {
    await this.model
      .updateOne({ day: r.day, running: { $gt: 0 } }, { $inc: { running: -1 } })
      .exec();
  }

  /** One AI call's real use. */
  async spent(r: Pick<Reservation, 'day'>, tokens: number): Promise<void> {
    await this.model
      .updateOne(
        { day: r.day },
        { $inc: { usedRequests: 1, usedTokens: tokens } },
        { upsert: true },
      )
      .exec();
  }

  /** Replaces what was set aside with what was really used. */
  async settle(
    r: Pick<Reservation, 'day' | 'requests' | 'tokens'>,
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
      maxRunning: this.limits.maxRunning,
      requests: {
        used: row?.usedRequests ?? 0,
        reserved: row?.reservedRequests ?? 0,
        budget: this.limits.dailyRequests,
      },
      tokens: {
        used: row?.usedTokens ?? 0,
        reserved: row?.reservedTokens ?? 0,
        budget: this.limits.dailyTokens,
      },
    };
  }
}
