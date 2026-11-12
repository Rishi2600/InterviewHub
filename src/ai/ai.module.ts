import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiClient, PrepAiClient } from './ai.types';
import { GroqClient, PREP_GROQ, PRACTICE_GROQ } from './groq.client';

/**
 * The AI provider: one client for practice, one for prep, each with its own
 * key and models. Features inject AiClient or PrepAiClient; tests override
 * them with a fake.
 */
@Module({
  providers: [
    {
      provide: AiClient,
      useFactory: (config: ConfigService) =>
        new GroqClient(config, PRACTICE_GROQ),
      inject: [ConfigService],
    },
    {
      provide: PrepAiClient,
      useFactory: (config: ConfigService) => new GroqClient(config, PREP_GROQ),
      inject: [ConfigService],
    },
  ],
  exports: [AiClient, PrepAiClient],
})
export class AiModule {}
