import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type ContestQuestionDocument = HydratedDocument<ContestQuestion>;
export const QUESTION_KINDS = ['single', 'multiple'] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

@Schema({ _id: false })
export class QuestionOption {
  // Chosen by the editor, unique within the question.
  @Prop({ required: true })
  id: string;

  @Prop({ default: '' })
  text: string;
}

const QuestionOptionSchema = SchemaFactory.createForClass(QuestionOption);

/**
 * One question of a quiz contest. Kept out of the contest document so the
 * answer key can never leak through a contest read.
 */
@Schema({ timestamps: true, collection: 'contest_questions' })
export class ContestQuestion {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Contest', required: true })
  contestId: Types.ObjectId;

  // Position in the host's order, from 0.
  @Prop({ required: true })
  order: number;

  @Prop({ type: String, enum: QUESTION_KINDS, required: true })
  kind: QuestionKind;

  @Prop({ default: '' })
  prompt: string;

  @Prop({ type: [QuestionOptionSchema], default: [] })
  options: QuestionOption[];

  @Prop({ type: [String], default: [] })
  correctOptionIds: string[];

  @Prop({ default: 1 })
  points: number;

  @Prop({ default: '' })
  explanation: string;
}

export const ContestQuestionSchema =
  SchemaFactory.createForClass(ContestQuestion);
ContestQuestionSchema.index({ contestId: 1, order: 1 }, { unique: true });
