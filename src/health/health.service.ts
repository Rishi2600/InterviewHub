import { Inject, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Redis } from 'ioredis';
import { Connection } from 'mongoose';
import { REDIS_CLIENT } from '../redis/redis.constants';

export type ComponentStatus = 'up' | 'down' | 'disabled';

export interface Readiness {
  ready: boolean;
  checks: { mongo: ComponentStatus; redis: ComponentStatus };
}

/** A dependency that does not answer within this long counts as down. */
const PING_TIMEOUT_MS = 1000;

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly mongo: Connection,
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  /** Pings Mongo, and Redis when it is enabled, in parallel. */
  async readiness(): Promise<Readiness> {
    const [mongo, redis] = await Promise.all([
      probe(async () => {
        if (!this.mongo.db) throw new Error('not connected');
        await this.mongo.db.admin().ping();
      }),
      this.redis ? probe(() => this.redis!.ping()) : ('disabled' as const),
    ]);
    return {
      ready: mongo === 'up' && redis !== 'down',
      checks: { mongo, redis },
    };
  }
}

async function probe(ping: () => Promise<unknown>): Promise<ComponentStatus> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), PING_TIMEOUT_MS);
  });
  try {
    await Promise.race([ping(), timeout]);
    return 'up';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}
