import { Injectable } from '@nestjs/common';
import { AiClient, PrepAiClient } from '../ai/ai.types';
import { DailyBudget } from '../ai/daily-budget';
import { PrepBudgetService } from '../prep/prep-budget.service';
import { AiBudgetService } from './ai-budget.service';
import { PracticePurpose } from './practice.constants';

/**
 * Which AI client and budget a session runs on: interviews on practice's,
 * coach sessions on prep's, so neither uses the other's free quota.
 */
@Injectable()
export class PracticeEngines {
  constructor(
    private readonly practiceAi: AiClient,
    private readonly prepAi: PrepAiClient,
    private readonly practiceBudget: AiBudgetService,
    private readonly prepBudget: PrepBudgetService,
  ) {}

  for(session: { purpose?: PracticePurpose }): {
    ai: AiClient;
    budget: DailyBudget;
  } {
    return session.purpose === 'coach'
      ? { ai: this.prepAi, budget: this.prepBudget }
      : { ai: this.practiceAi, budget: this.practiceBudget };
  }
}
