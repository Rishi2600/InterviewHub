import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardGateway } from './leaderboard.gateway';
import { AuthModule } from '../auth/auth.module';
import { Contest, ContestSchema } from '../contests/schemas/contest.schema';
import {
  ContestEntry,
  ContestEntrySchema,
} from '../contests/schemas/contest-entry.schema';

@Module({
  imports: [
    AuthModule, // provides JwtModule for WsJwtGuard
    // Read directly for the subscribe check: injecting ContestsService would
    // be circular, since it already depends on this module's gateway.
    MongooseModule.forFeature([
      { name: Contest.name, schema: ContestSchema },
      { name: ContestEntry.name, schema: ContestEntrySchema },
    ]),
  ],
  providers: [LeaderboardService, LeaderboardGateway],
  exports: [LeaderboardService, LeaderboardGateway],
})
export class LeaderboardModule {}
