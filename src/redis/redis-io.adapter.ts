import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { ServerOptions } from 'socket.io';
import { REDIS_PUB_CLIENT, REDIS_SUB_CLIENT } from './redis.constants';
import { isAllowedOrigin } from '../config/cors';
import { LIMITS } from '../common/validation/limits';

/**
 * Socket.io adapter used for every gateway. It applies the CORS_ORIGINS
 * allowlist and, when Redis is enabled, Redis pub/sub so broadcasts reach
 * clients on other server instances (otherwise the in-memory adapter is used,
 * which is fine for a single instance).
 */
export class RedisIoAdapter extends IoAdapter {
  // Not named `logger`: IoAdapter declares its own since Nest 12.
  private readonly redisLogger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(
    private readonly app: INestApplicationContext,
    private readonly allowedOrigins: string[],
  ) {
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
    const server = super.createIOServer(port, {
      ...options,
      // Drop any single socket message larger than this.
      maxHttpBufferSize: LIMITS.socketMessageBytes,
      // `cors` only covers HTTP long-polling. Browsers do not apply CORS to
      // WebSocket upgrades, so the Origin header is checked here as well.
      cors: { origin: this.allowedOrigins },
      allowRequest: (req, done) =>
        done(null, isAllowedOrigin(req.headers.origin, this.allowedOrigins)),
    } as ServerOptions);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
