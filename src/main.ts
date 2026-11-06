import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  // Logs from startup are held until the pino logger is ready.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(PinoLogger));
  configureApp(app);

  const port = app.get(ConfigService).get<number>('PORT') ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(
    `InterviewHub running on http://localhost:${port}`,
  );
}
void bootstrap();
