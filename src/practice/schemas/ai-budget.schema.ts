import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AiBudgetDocument = HydratedDocument<AiBudget>;

/**
 * The app's AI use for one UTC day. `reserved*` is what interviews have set
 * aside (a full interview's worth while running, what they used once
 * settled); a new interview starts only if its share still fits under the
 * budget. `used*` is what was really spent, for the admin view.
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

  // Interviews started this day that are still running.
  @Prop({ default: 0 })
  running: number;
}

export const AiBudgetSchema = SchemaFactory.createForClass(AiBudget);
