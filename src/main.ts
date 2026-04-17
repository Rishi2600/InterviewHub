import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server } from 'socket.io';
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
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    }) as Server;
    server.adapter(this.adapterConstructor);
    return server;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // 1. Global prefix
  app.setGlobalPrefix('api/v1');

  // 2. CORS
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // 3. Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 4. Redis connection
  const redisUrl = config.get<string>('REDIS_URL') as string;

  if (!redisUrl) {
    throw new Error('REDIS_URL is not defined in your .env file');
  }

  const pubClient = createClient({
    url: redisUrl,
    //@ts-ignore
    socket: {
      tls: redisUrl.startsWith('rediss://'),
      rejectUnauthorized: false,
    },
  });

  const subClient = pubClient.duplicate();

  pubClient.on('error', (err) => console.error('Redis pub error:', err));
  subClient.on('error', (err) => console.error('Redis sub error:', err));

  await Promise.all([pubClient.connect(), subClient.connect()]);
  console.log('Redis connected');

  // 5. Attach Redis adapter to Socket.io
  const adapterConstructor = createAdapter(pubClient, subClient);
  app.useWebSocketAdapter(new RedisIoAdapter(app, adapterConstructor));

  // 6. Start
  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  console.log(`Listening at http://localhost:${port}/api/v1`);
}

bootstrap();