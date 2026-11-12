import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AiBudgetDocument = HydratedDocument<AiBudget>;

/**
 * One feature's AI use for one UTC day. `reserved*` is what sessions have set
 * aside (a full session's worth while running, what they used once
 * settled); a new session starts only if its share still fits under the
 * budget. `used*` is what was really spent, for the admin view. Practice
 * keeps it in `ai_budget`, prep in `prep_ai_budget` (see DailyBudget).
 */
@Schema({ timestamps: true, collection: 'ai_budget' })
export class AiBudget {
  // 'YYYY-MM-DD' in UTC.
  @Prop({ required: true, unique: true })
  day: string;

  @Prop({ default: 0 })
  reservedRequests: number;

  @Prop({ default: 0 })
  reservedTokens: number;

  @Prop({ default: 0 })
  usedRequests: number;

  @Prop({ default: 0 })
  usedTokens: number;

  // Sessions started this day that are still running.
  @Prop({ default: 0 })
  running: number;
}

export const AiBudgetSchema = SchemaFactory.createForClass(AiBudget);
