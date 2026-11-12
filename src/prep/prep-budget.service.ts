import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DailyBudget, Refusal, Reservation } from '../ai/daily-budget';
import { AiBudget } from '../ai/schemas/ai-budget.schema';
import { PREP_LIMITS } from './prep.constants';

/** Prep's own budget rows, kept apart from practice's. */
export const PREP_AI_BUDGET = 'PrepAiBudget';
// One request per answer, an opening and the recap.
export const COACH_REQUESTS = 20 + 2;

/**
 * Prep's share of the free limits (`AI_PREP_*`), on prep's own model. A
 * coach session reserves a full-length session and counts as running;
 * writing a batch of drill questions reserves one batch's worth.
 */
@Injectable()
export class PrepBudgetService extends DailyBudget {
  readonly tokensPerCoach: number;

  constructor(
    @InjectModel(PREP_AI_BUDGET) model: Model<AiBudget>,
    config: ConfigService,
  ) {
    super(model, {
      dailyRequests: Number(config.get('AI_PREP_DAILY_REQUESTS')),
      dailyTokens: Number(config.get('AI_PREP_DAILY_TOKENS')),
      maxRunning: Number(config.get('AI_PREP_MAX_RUNNING')),
    });
    this.tokensPerCoach = Number(config.get('AI_PREP_TOKENS_PER_COACH'));
  }

  reserveCoach(now: Date): Promise<Reservation | Refusal> {
    return this.take(
      now,
      { requests: COACH_REQUESTS, tokens: this.tokensPerCoach },
      true,
    );
  }

  reserveWriting(now: Date): Promise<Reservation | Refusal> {
    return this.take(
      now,
      { requests: PREP_LIMITS.writeRequests, tokens: PREP_LIMITS.writeTokens },
      false,
    );
  }
}
