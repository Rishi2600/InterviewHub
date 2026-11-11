import { Module } from '@nestjs/common';
import { AiClient } from './ai.types';
import { GroqClient } from './groq.client';

/** The AI provider. Features inject AiClient; tests override it with a fake. */
@Module({
  providers: [{ provide: AiClient, useClass: GroqClient }],
  exports: [AiClient],
})
export class AiModule {}
