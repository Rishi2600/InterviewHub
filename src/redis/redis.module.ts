import { Global, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import {
  REDIS_CLIENT,
  REDIS_PUB_CLIENT,
  REDIS_SUB_CLIENT,
} from './redis.constants';

/**
 * Provides Redis clients when REDIS_ENABLED=true, otherwise provides `null`.
 * Every consumer must treat a null client as "Redis unavailable" and fall
 * back to its in-memory path. This is what lets the whole app run with no
 * Redis at all.
 *
 * Three clients are created when enabled:
 *  - REDIS_CLIENT     general commands (leaderboard sorted sets)
 *  - REDIS_PUB_CLIENT Socket.io adapter publisher
 *  - REDIS_SUB_CLIENT Socket.io adapter subscriber
 */
const logger = new Logger('RedisModule');

function createClient(url: string, label: string): Redis {
  const client = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 2,
    retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
  });
  client.on('connect', () => logger.log(`Redis connected (${label})`));
  client.on('error', (err) =>
    logger.warn(`Redis error (${label}): ${err.message}`),
  );
  return client;
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis | null => {
        if (!config.get<boolean>('REDIS_ENABLED')) {
          logger.warn('REDIS_ENABLED=false -> using in-memory fallbacks');
          return null;
        }
        return createClient(config.get<string>('REDIS_URL')!, 'client');
      },
    },
    {
      provide: REDIS_PUB_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis | null =>
        config.get<boolean>('REDIS_ENABLED')
          ? createClient(config.get<string>('REDIS_URL')!, 'pub')
          : null,
    },
    {
      provide: REDIS_SUB_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis | null =>
        config.get<boolean>('REDIS_ENABLED')
          ? createClient(config.get<string>('REDIS_URL')!, 'sub')
          : null,
    },
  ],
  exports: [REDIS_CLIENT, REDIS_PUB_CLIENT, REDIS_SUB_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor() {}
  onModuleDestroy(): void {
    // ioredis clients are cleaned up by the runtime on shutdown; nothing to do.
  }
}
