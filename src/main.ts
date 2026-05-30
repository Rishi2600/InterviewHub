import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Serve HTML pages
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Serve uploaded files (disk approach)
  // ./uploads/avatars/filename.jpg → http://localhost:3000/uploads/avatars/filename.jpg
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads',
  });

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'], credentials: true });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  console.log(`✓ App running at http://localhost:${port}`);
}

bootstrap();