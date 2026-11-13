import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityModule } from '../activity/activity.module';
import { AiModule } from '../ai/ai.module';
import { AiBudgetSchema } from '../ai/schemas/ai-budget.schema';
import { DrillService } from './drill.service';
import { PREP_AI_BUDGET, PrepBudgetService } from './prep-budget.service';
import { PrepUsageService } from './prep-usage.service';
import { PrepController } from './prep.controller';
import { PrepService } from './prep.service';
import { QuestionWriter } from './question-writer.service';
import { PrepDrill, PrepDrillSchema } from './schemas/prep-drill.schema';
import { PrepProfile, PrepProfileSchema } from './schemas/prep-profile.schema';
import {
  PrepQuestion,
  PrepQuestionSchema,
} from './schemas/prep-question.schema';
import { PrepUsage, PrepUsageSchema } from './schemas/prep-usage.schema';

/** Interview prep: drills and the AI coach. See docs/PREP_DESIGN.md. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PrepQuestion.name, schema: PrepQuestionSchema },
      { name: PrepDrill.name, schema: PrepDrillSchema },
      { name: PrepUsage.name, schema: PrepUsageSchema },
      { name: PrepProfile.name, schema: PrepProfileSchema },
      {
        name: PREP_AI_BUDGET,
        schema: AiBudgetSchema,
        collection: 'prep_ai_budget',
      },
    ]),
    ActivityModule, // a square on the activity graph
    AiModule,
  ],
  controllers: [PrepController],
  providers: [
    PrepBudgetService,
    PrepUsageService,
    QuestionWriter,
    DrillService,
    PrepService,
  ],
})
export class PrepModule {}
