import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { ServerOptions } from 'socket.io';
import { REDIS_PUB_CLIENT, REDIS_SUB_CLIENT } from './redis.constants';

/**
 * Socket.io adapter that uses Redis pub/sub to broadcast events across multiple
 * server instances. Only activated when Redis is enabled; otherwise the default
 * in-memory adapter is used (single instance), which is fine for dev/MVP.
 */
export class RedisIoAdapter extends IoAdapter {
  // Not named `logger`: IoAdapter declares its own since Nest 12.
  private readonly redisLogger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  connect(): boolean {
    const pub = this.app.get<Redis | null>(REDIS_PUB_CLIENT, { strict: false });
    const sub = this.app.get<Redis | null>(REDIS_SUB_CLIENT, { strict: false });
    if (pub && sub) {
      this.adapterConstructor = createAdapter(pub, sub);
      this.redisLogger.log('Socket.io Redis adapter enabled');
      return true;
    }
    this.redisLogger.warn(
      'Redis not enabled -> Socket.io using in-memory adapter',
    );
    return false;
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
