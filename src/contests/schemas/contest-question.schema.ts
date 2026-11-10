import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { CODE_LANGUAGES, CodeLanguage } from '../../judge/sandbox/types';

export type ContestQuestionDocument = HydratedDocument<ContestQuestion>;
export const QUESTION_KINDS = ['single', 'multiple', 'code'] as const;
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

/** One test of a code question: an input and the output it must produce.
 *  Visible tests are shown as examples; hidden ones never leave the server. */
@Schema({ _id: false })
export class CodeTest {
  @Prop({ default: '' })
  input: string;

  @Prop({ default: '' })
  output: string;

  @Prop({ default: false })
  visible: boolean;
}

const CodeTestSchema = SchemaFactory.createForClass(CodeTest);

@Schema({ _id: false })
export class StarterCode {
  @Prop({ default: '' })
  python: string;

  @Prop({ default: '' })
  javascript: string;

  @Prop({ default: '' })
  typescript: string;
}

const StarterCodeSchema = SchemaFactory.createForClass(StarterCode);

/** The host's own answer, kept for their records. Never sent to entrants
 *  and never used for scoring. */
@Schema({ _id: false })
export class HostAnswer {
  @Prop({ type: String, enum: CODE_LANGUAGES, required: true })
  language: CodeLanguage;

  @Prop({ default: '' })
  code: string;
}

const HostAnswerSchema = SchemaFactory.createForClass(HostAnswer);

/**
 * One question of a contest. Kept out of the contest document so the
 * answer key (and a code question's hidden tests) can never leak through a
 * contest read.
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

  // A code question's statement; a quiz question's text.
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

  // --- Code questions only ---

  @Prop({ default: '' })
  title: string;

  @Prop({ type: StarterCodeSchema, default: () => ({}) })
  starterCode: StarterCode;

  @Prop({ type: [CodeTestSchema], default: [] })
  tests: CodeTest[];

  @Prop({ default: 2_000 })
  timeLimitMs: number;

  @Prop({ type: HostAnswerSchema, default: null })
  hostAnswer: HostAnswer | null;

  // Filled in at finalize, for the host's per-question breakdown. For a code
  // question: entrants who submitted, and those who passed every test.
  @Prop({ default: 0 })
  answeredCount: number;

  @Prop({ default: 0 })
  correctCount: number;
}

export const ContestQuestionSchema =
  SchemaFactory.createForClass(ContestQuestion);
ContestQuestionSchema.index({ contestId: 1, order: 1 }, { unique: true });
