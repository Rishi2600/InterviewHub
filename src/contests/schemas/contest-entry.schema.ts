import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { CODE_LANGUAGES, CodeLanguage } from '../../judge/sandbox/types';

export type ContestEntryDocument = HydratedDocument<ContestEntry>;

@Schema({ _id: false })
export class EntryAnswer {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  questionId: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  optionIds: string[];

  @Prop({ type: Date, required: true })
  answeredAt: Date;
}

const EntryAnswerSchema = SchemaFactory.createForClass(EntryAnswer);

/** Code being written for one question, saved as the entrant types. Only
 *  submissions are judged; a draft is never scored. */
@Schema({ _id: false })
export class CodeDraft {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  questionId: Types.ObjectId;

  @Prop({ type: String, enum: CODE_LANGUAGES, required: true })
  language: CodeLanguage;

  @Prop({ default: '' })
  code: string;

  @Prop({ type: Date, required: true })
  savedAt: Date;
}

const CodeDraftSchema = SchemaFactory.createForClass(CodeDraft);

/** One user's entry in one contest: when they joined, started and
 *  submitted, their saved answers and, after the end, their result. */
@Schema({ timestamps: true, collection: 'contest_entries' })
export class ContestEntry {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Contest', required: true })
  contestId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  username: string;

  @Prop({ type: Date, required: true })
  joinedAt: Date;

  @Prop({ type: Date, default: null })
  startedAt: Date | null;

  @Prop({ type: Date, default: null })
  submittedAt: Date | null;

  // Submitted by the clock at the end rather than by the entrant.
  @Prop({ default: false })
  autoSubmitted: boolean;

  @Prop({ type: [EntryAnswerSchema], default: [] })
  answers: EntryAnswer[];

  // Code contests: one draft per question, in the language last used.
  @Prop({ type: [CodeDraftSchema], default: [] })
  drafts: CodeDraft[];

  // Result fields, filled in at finalize.
  @Prop({ type: Number, default: null })
  score: number | null;

  @Prop({ type: Number, default: null })
  timeUsedMs: number | null;

  @Prop({ type: Number, default: null })
  rank: number | null;

  @Prop({ type: Number, default: null })
  percentile: number | null;
}

export const ContestEntrySchema = SchemaFactory.createForClass(ContestEntry);
// One entry per (contest, user).
ContestEntrySchema.index({ contestId: 1, userId: 1 }, { unique: true });
ContestEntrySchema.index({ contestId: 1, rank: 1 });
ContestEntrySchema.index({ userId: 1, joinedAt: -1 });
