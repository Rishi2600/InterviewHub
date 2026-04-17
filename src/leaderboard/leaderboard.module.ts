import { Module } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardGateway } from './leaderboard.gateway';

@Module({
  providers: [LeaderboardService, LeaderboardGateway],
  exports: [LeaderboardService], // ContestsModule needs LeaderboardService
})
export class LeaderboardModule {}