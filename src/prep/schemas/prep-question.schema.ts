import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { LEVELS, type Level } from '../../common/topics';

export type PrepQuestionDocument = HydratedDocument<PrepQuestion>;

@Schema({ _id: false })
export class PrepOption {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  text: string;
}

/**
 * One multiple-choice question in the shared drill bank: written once by the
 * AI, then served to every candidate on its topic and level who hasn't seen
 * it. See docs/PREP_DESIGN.md §2.
 */
@Schema({ timestamps: true, collection: 'prep_questions' })
export class PrepQuestion {
  @Prop({ required: true })
  topic: string;

  @Prop({ type: String, enum: LEVELS, required: true })
  level: Level;

  @Prop({ required: true })
  prompt: string;

  // A short code block shown under the prompt, or null.
  @Prop({ type: String, default: null })
  code: string | null;

  @Prop({ type: [PrepOption], required: true })
  options: PrepOption[];

  // The id of the one correct option. Never sent before it's answered.
  @Prop({ required: true })
  correct: string;

  @Prop({ required: true })
  explanation: string;

  // The normalised prompt's hash, so a shelf never holds the same question twice.
  @Prop({ required: true })
  hash: string;

  @Prop({ required: true })
  model: string;

  @Prop({ type: [SchemaTypes.ObjectId], default: [] })
  flaggedBy: Types.ObjectId[];

  @Prop({ default: false })
  hidden: boolean;

  // How often it was answered, and answered right.
  @Prop({ default: 0 })
  answered: number;

  @Prop({ default: 0 })
  right: number;
}

export const PrepQuestionSchema = SchemaFactory.createForClass(PrepQuestion);
PrepQuestionSchema.index({ topic: 1, level: 1, hash: 1 }, { unique: true });
PrepQuestionSchema.index({ topic: 1, level: 1, hidden: 1 });
