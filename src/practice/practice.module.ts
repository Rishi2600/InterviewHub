import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityModule } from '../activity/activity.module';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { AiBudgetService } from './ai-budget.service';
import { PracticeConversationService } from './practice-conversation.service';
import { PracticeFeedbackService } from './practice-feedback.service';
import { PracticeController } from './practice.controller';
import { PracticeGateway } from './practice.gateway';
import { PracticeJob } from './practice.job';
import { PracticeNotifier } from './practice.notifier';
import { PracticeService } from './practice.service';
import { AiBudget, AiBudgetSchema } from './schemas/ai-budget.schema';
import {
  PracticeInterview,
  PracticeInterviewSchema,
} from './schemas/practice-interview.schema';
import {
  PracticeUsage,
  PracticeUsageSchema,
} from './schemas/practice-usage.schema';

/** AI practice interviews. See docs/learning/ai/ and guides/ai-practice.md. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PracticeInterview.name, schema: PracticeInterviewSchema },
      { name: PracticeUsage.name, schema: PracticeUsageSchema },
      { name: AiBudget.name, schema: AiBudgetSchema },
    ]),
    ActivityModule, // a square on the activity graph
    AuthModule, // SocketAuthService for the gateway
    AiModule,
  ],
  controllers: [PracticeController],
  providers: [
    AiBudgetService,
    PracticeNotifier,
    PracticeFeedbackService,
    PracticeService,
    PracticeConversationService,
    PracticeGateway,
    PracticeJob,
  ],
})
export class PracticeModule {}
