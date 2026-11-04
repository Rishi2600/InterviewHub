import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import helmet from 'helmet';
import { RedisIoAdapter } from './redis/redis-io.adapter';
import { parseOrigins } from './config/cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const allowedOrigins = parseOrigins(config.get<string>('CORS_ORIGINS'));
  app.enableCors({ origin: allowedOrigins });

  // Security headers. The API serves JSON, never pages, so the CSP allows
  // nothing. Resources may be loaded cross-origin because the frontend shows
  // avatars from /uploads on its own origin; responses carry no cookies.
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

  // Global validation: strip unknown fields, transform payloads to DTO types.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
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
