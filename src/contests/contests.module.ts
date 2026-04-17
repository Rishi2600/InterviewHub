import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContestsController } from './contests.controller';
import { ContestsService } from './contests.service';
import { Contest, ContestSchema } from './schemas/contest.schema';
import { ContestEntry, ContestEntrySchema } from './schemas/contest-entry.schema';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contest.name, schema: ContestSchema },
      { name: ContestEntry.name, schema: ContestEntrySchema },
    ]),
    LeaderboardModule, // ContestsService calls LeaderboardService to award scores
    RoomsModule,
  ],
  controllers: [ContestsController],
  providers: [ContestsService],
  exports: [ContestsService],
})
export class ContestsModule {}