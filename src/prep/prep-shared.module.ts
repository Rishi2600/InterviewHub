import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiBudgetSchema } from '../ai/schemas/ai-budget.schema';
import { PREP_AI_BUDGET, PrepBudgetService } from './prep-budget.service';
import { PrepUsageService } from './prep-usage.service';
import { PrepUsage, PrepUsageSchema } from './schemas/prep-usage.schema';

/**
 * Prep's AI budget and daily limits on their own, so the practice engine can
 * charge coach sessions to them without importing the whole prep module.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: PREP_AI_BUDGET,
        schema: AiBudgetSchema,
        collection: 'prep_ai_budget',
      },
      { name: PrepUsage.name, schema: PrepUsageSchema },
    ]),
  ],
  providers: [PrepBudgetService, PrepUsageService],
  exports: [PrepBudgetService, PrepUsageService],
})
export class PrepSharedModule {}
