import {
  Global,
  Inject,
  Logger,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
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
 *  - REDIS_CLIENT     general commands (the readiness check)
 *  - REDIS_PUB_CLIENT Socket.io adapter publisher
 *  - REDIS_SUB_CLIENT Socket.io adapter subscriber
 */
const logger = new Logger('RedisModule');

/**
 * Every client keeps reconnecting, at most 2 s apart: giving up would leave
 * the app without Redis until it is restarted. The general client fails a
 * command after 2 retries, so callers and the health check see the outage
 * instead of hanging. The pub/sub clients queue commands until Redis is
 * back, because the Socket.io adapter does not catch a failed subscribe and
 * the unhandled rejection would crash the process.
 */
function createClient(url: string, label: 'client' | 'pub' | 'sub'): Redis {
  const client = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: label === 'client' ? 2 : null,
    retryStrategy: (times) => Math.min(times * 200, 2000),
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
export class RedisModule implements OnApplicationShutdown {
  constructor(
    @Inject(REDIS_CLIENT) private readonly client: Redis | null,
    @Inject(REDIS_PUB_CLIENT) private readonly pub: Redis | null,
    @Inject(REDIS_SUB_CLIENT) private readonly sub: Redis | null,
  ) {}

  /**
   * Closes the clients so the process can exit. Runs after the HTTP and
   * socket servers have closed, so the Socket.io adapter has already
   * unsubscribed.
   */
  async onApplicationShutdown(): Promise<void> {
    await Promise.all(
      [this.client, this.pub, this.sub].map(async (c) => {
        if (!c) return;
        await c.quit().catch(() => c.disconnect());
      }),
    );
  }
}
