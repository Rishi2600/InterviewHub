import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiBudgetSchema } from '../ai/schemas/ai-budget.schema';
import { PREP_AI_BUDGET, PrepBudgetService } from './prep-budget.service';

/**
 * Prep's AI budget on its own, so the practice engine can charge coach
 * sessions to it without importing the whole prep module.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: PREP_AI_BUDGET,
        schema: AiBudgetSchema,
        collection: 'prep_ai_budget',
      },
    ]),
  ],
  providers: [PrepBudgetService],
  exports: [PrepBudgetService],
})
export class PrepBudgetModule {}
