import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityModule } from '../activity/activity.module';
import { Contest, ContestSchema } from '../contests/schemas/contest.schema';
import { UsersModule } from '../users/users.module';
import { UserScore, UserScoreSchema } from './schemas/user-score.schema';
import { ScoreService } from './score.service';
import { ScoreController } from './score.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserScore.name, schema: UserScoreSchema },
      // Read only, for contest titles in the history.
      { name: Contest.name, schema: ContestSchema },
    ]),
    ActivityModule,
    UsersModule,
  ],
  controllers: [ScoreController],
  providers: [ScoreService],
  exports: [ScoreService],
})
export class ScoreModule {}
