//@ts-nocheck

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server } from 'socket.io';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app: any, adapterConstructor: ReturnType<typeof createAdapter>) {
    super(app);
    this.adapterConstructor = adapterConstructor;
  }

  createIOServer(port: number, options?: any): Server {
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
    }) as Server;
    server.adapter(this.adapterConstructor);
    return server;
  }
}

async function bootstrap() {
  // NestExpressApplication (instead of the default) gives us
  // useStaticAssets() to serve the public/ folder
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Serve everything in /public as static files
  // http://localhost:3000/index.html, /room.html, /app.js etc.
  app.useStaticAssets(join(__dirname, '..', 'public'));

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'], credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const redisUrl = config.get<string>('REDIS_URL') as string;
  if (!redisUrl) throw new Error('REDIS_URL is not defined in your .env file');

  const pubClient = createClient({
    url: redisUrl,
    socket: { tls: redisUrl.startsWith('rediss://'), rejectUnauthorized: false },
  });
  const subClient = pubClient.duplicate();

  pubClient.on('error', (err) => console.error('Redis pub error:', err));
  subClient.on('error', (err) => console.error('Redis sub error:', err));

  await Promise.all([pubClient.connect(), subClient.connect()]);
  console.log('✓ Redis connected');

  const adapterConstructor = createAdapter(pubClient, subClient);
  app.useWebSocketAdapter(new RedisIoAdapter(app, adapterConstructor));

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  console.log(`✓ App running at http://localhost:${port}`);
}

bootstrap();