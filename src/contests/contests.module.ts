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
import { ActivityModule } from '../activity/activity.module';
import { ContestsService } from './contests.service';
import { ContestsController } from './contests.controller';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contest.name, schema: ContestSchema },
      { name: ContestEntry.name, schema: ContestEntrySchema },
      { name: ContestQuestion.name, schema: ContestQuestionSchema },
      { name: HostUsage.name, schema: HostUsageSchema },
    ]),
    ActivityModule,
    LeaderboardModule,
  ],
  controllers: [ContestsController],
  providers: [ContestsService],
  exports: [ContestsService],
})
export class ContestsModule {}
