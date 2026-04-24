import { Module } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardGateway } from './leaderboard/leaderboard.gateway';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { WsJwtGuard } from '../common/ws-jwt.guard';

@Module({
  imports: [
    AuthModule,
    UsersModule,
  ],
  providers: [LeaderboardService, LeaderboardGateway, WsJwtGuard],
  exports: [LeaderboardService, LeaderboardGateway],
})
export class LeaderboardModule {}