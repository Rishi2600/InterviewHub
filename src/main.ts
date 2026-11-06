import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { RedisIoAdapter } from './redis/redis-io.adapter';
import { parseOrigins } from './config/cors';
import { LIMITS } from './common/validation/limits';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // req.ip, and so every per-IP rate limit, trusts only this many proxy hops.
  // Trusting more than really exist would let clients forge their IP.
  app.set('trust proxy', config.get<number>('TRUST_PROXY') ?? 0);

  const allowedOrigins = parseOrigins(config.get<string>('CORS_ORIGINS'));
  app.enableCors({
    origin: allowedOrigins,
    // The refresh cookie travels with /auth requests from the frontend.
    credentials: true,
    // Lets the frontend read how long to wait after a 429.
    exposedHeaders: ['Retry-After', 'Retry-After-hourly'],
  });

  // Security headers. The API serves JSON, never pages, so the CSP allows
  // nothing. Resources may be loaded cross-origin because the frontend shows
  // avatars from /uploads on its own origin.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      frameguard: { action: 'deny' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(cookieParser());
  app.useBodyParser('json', { limit: LIMITS.bodyBytes });

  // Global validation: reject unknown fields, transform payloads to DTO types.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Always used: it applies the origin allowlist to sockets, and adds Redis
  // pub/sub only when Redis is enabled.
  const ioAdapter = new RedisIoAdapter(app, allowedOrigins);
  ioAdapter.connect();
  app.useWebSocketAdapter(ioAdapter);

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  logger.log(`InterviewHub running on http://localhost:${port}`);
}
void bootstrap();
