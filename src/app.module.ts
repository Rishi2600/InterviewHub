import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersService } from './users/users.service';
import { UsersModule } from './users/users.module';
import { RoomsModule } from './rooms/rooms.module';
import { ChatModule } from './chat/chat.module';
import { ContestsModule } from './contests/contests.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';

@Module({
  imports: [AuthModule, UsersModule, RoomsModule, ChatModule, ContestsModule, LeaderboardModule],
  controllers: [AppController],
  providers: [AppService, UsersService],
})
export class AppModule {}
