import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DailyBudget, Refusal, Reservation } from '../ai/daily-budget';
import { AiBudget } from '../ai/schemas/ai-budget.schema';
import { PRACTICE_LIMITS } from './practice.constants';

export type { Refusal, Reservation } from '../ai/daily-budget';
export { utcDay } from '../ai/daily-budget';

/**
 * Practice's share of the free limits (`AI_DAILY_*`). An interview starts
 * only if a full-length one still fits in today's budget and fewer than
 * AI_MAX_RUNNING are running, so a started interview can always finish.
 */
@Injectable()
export class AiBudgetService extends DailyBudget {
  readonly tokensPerInterview: number;

  constructor(
    @InjectModel(AiBudget.name) model: Model<AiBudget>,
    config: ConfigService,
  ) {
    super(model, {
      dailyRequests: Number(config.get('AI_DAILY_REQUESTS')),
      dailyTokens: Number(config.get('AI_DAILY_TOKENS')),
      maxRunning: Number(config.get('AI_MAX_RUNNING')),
    });
    this.tokensPerInterview = Number(config.get('AI_TOKENS_PER_INTERVIEW'));
  }

  /** Sets aside a full-length interview. */
  reserve(now: Date): Promise<Reservation | Refusal> {
    return this.take(
      now,
      {
        requests: PRACTICE_LIMITS.requestsPerInterview,
        tokens: this.tokensPerInterview,
      },
      true,
    );
  }
}
