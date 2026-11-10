import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Contest, ContestSchema } from './schemas/contest.schema';
import {
  ContestEntry,
  ContestEntrySchema,
} from './schemas/contest-entry.schema';
import {
  ContestQuestion,
  ContestQuestionSchema,
} from './schemas/contest-question.schema';
import { HostUsage, HostUsageSchema } from './schemas/host-usage.schema';
import {
  CodeSubmission,
  CodeSubmissionSchema,
} from './schemas/code-submission.schema';
import { ActivityModule } from '../activity/activity.module';
import { ContestsService } from './contests.service';
import { ContestHostingService } from './contest-hosting.service';
import { ContestEntrantService } from './contest-entrant.service';
import { ContestsController } from './contests.controller';
import { FinalizeService } from './finalize/finalize.service';
import { FinalizeJob } from './finalize/finalize.job';
import { ContestsGateway } from './contests.gateway';
import { AuthModule } from '../auth/auth.module';
import { ScoreModule } from '../score/score.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contest.name, schema: ContestSchema },
      { name: ContestEntry.name, schema: ContestEntrySchema },
      { name: ContestQuestion.name, schema: ContestQuestionSchema },
      { name: HostUsage.name, schema: HostUsageSchema },
      { name: CodeSubmission.name, schema: CodeSubmissionSchema },
    ]),
    ActivityModule,
    AuthModule, // SocketAuthService for the gateway
    ScoreModule, // recomputed at finalize
  ],
  controllers: [ContestsController],
  providers: [
    ContestsService,
    ContestHostingService,
    ContestEntrantService,
    FinalizeService,
    FinalizeJob,
    ContestsGateway,
  ],
  exports: [ContestsService],
})
export class ContestsModule {}
