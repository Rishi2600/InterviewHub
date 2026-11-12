import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AiUnavailableError,
  PrepAiClient,
  countedTokens,
} from '../ai/ai.types';
import { isDuplicateKey } from '../common/mongo-errors';
import type { Level } from '../common/topics';
import {
  QUESTION_SET_SCHEMA,
  parseQuestionSet,
  writeMessages,
} from './drill-questions';
import { PrepBudgetService } from './prep-budget.service';
import { PrepQuestion } from './schemas/prep-question.schema';

// The newest questions on the shelf the AI is told not to repeat.
const AVOID = 30;
const MAX_TOKENS = 5_000;

/**
 * Fills the drill bank: one AI request writes a batch for a topic and
 * level, the sound questions are saved for everyone. See
 * docs/PREP_DESIGN.md §2.
 */
@Injectable()
export class QuestionWriter {
  private readonly logger = new Logger(QuestionWriter.name);

  constructor(
    @InjectModel(PrepQuestion.name)
    private readonly model: Model<PrepQuestion>,
    private readonly ai: PrepAiClient,
    private readonly budget: PrepBudgetService,
  ) {}

  get enabled(): boolean {
    return this.ai.enabled;
  }

  /** Writes one batch; how many were saved. 0 when the AI or budget is out. */
  async write(topic: string, level: Level, now = new Date()): Promise<number> {
    if (!this.ai.enabled) return 0;
    const reservation = await this.budget.reserveWriting(now);
    if (typeof reservation === 'string') return 0;
    const used = { requests: 0, tokens: 0 };
    try {
      const shelf = await this.model
        .find({ topic, level })
        .select('prompt hash')
        .sort({ _id: -1 })
        .lean()
        .exec();
      const known = new Set(shelf.map((q) => q.hash));
      const avoid = shelf.slice(0, AVOID).map((q) => q.prompt.slice(0, 120));
      for (let attempt = 0; attempt < reservation.requests; attempt++) {
        const res = await this.ai.chat({
          messages: writeMessages(topic, level, avoid),
          maxTokens: MAX_TOKENS,
          json: QUESTION_SET_SCHEMA,
        });
        const tokens = countedTokens(res.usage);
        used.requests += 1;
        used.tokens += tokens;
        await this.budget.spent(reservation, tokens);
        const written = parseQuestionSet(res.text, known);
        if (!written.length) continue;
        let saved = 0;
        for (const q of written) {
          try {
            await this.model.create({
              ...q,
              topic,
              level,
              model: res.usage.model,
            });
            saved += 1;
          } catch (err) {
            // Someone else wrote the same question a moment ago.
            if (!isDuplicateKey(err)) throw err;
          }
        }
        return saved;
      }
      return 0;
    } catch (err) {
      if (err instanceof AiUnavailableError) return 0;
      this.logger.error(`Writing ${topic} ${level}: ${(err as Error).message}`);
      return 0;
    } finally {
      await this.budget.settle(reservation, used);
    }
  }
}
