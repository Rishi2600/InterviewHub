import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';

import { envValidationSchema } from './config/env.validation';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoomsModule } from './rooms/rooms.module';
import { ChatModule } from './chat/chat.module';
import { ContestsModule } from './contests/contests.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { HealthModule } from './health/health.module';
import { THROTTLERS } from './common/throttle/limits';
import { HttpThrottleGuard } from './common/throttle/http-throttle.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
      }),
    }),
    ThrottlerModule.forRoot({
      throttlers: THROTTLERS,
      errorMessage: 'Too many requests, please try again later',
    }),
    // Serve uploaded files at /uploads/**. The React client in frontend/ is
    // built and served separately, so nothing is served at /.
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: {
        index: false,
        // Defence in depth for user uploads: never sniff a type, download
        // instead of rendering when opened directly (<img> still works), and
        // forbid any script even if a non-image ever got stored.
        setHeaders: (res) => {
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Content-Disposition', 'attachment');
          res.setHeader(
            'Content-Security-Policy',
            "default-src 'none'; sandbox",
          );
        },
      },
    }),
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RoomsModule,
    ChatModule,
    ContestsModule,
    LeaderboardModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: HttpThrottleGuard }],
})
export class AppModule {}
