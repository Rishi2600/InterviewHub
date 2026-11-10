import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import {
  CODE_LANGUAGES,
  CodeLanguage,
  TestVerdict,
} from '../../judge/sandbox/types';

export type CodeSubmissionDocument = HydratedDocument<CodeSubmission>;
export const SUBMISSION_STATUSES = [
  'queued',
  'running',
  'done',
  'failed',
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

@Schema({ _id: false })
export class TestResult {
  @Prop({ type: String, required: true })
  verdict: TestVerdict;

  @Prop({ default: 0 })
  ms: number;
}

const TestResultSchema = SchemaFactory.createForClass(TestResult);

/**
 * One Submit of a code question. It is also the judge's job: the API writes
 * it as `queued`, a judge process claims it (`running`, with a lease) and
 * writes the verdicts (`done`). See docs/learning/sandbox/WASM_SANDBOX.md.
 */
@Schema({ timestamps: true, collection: 'code_submissions' })
export class CodeSubmission {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Contest', required: true })
  contestId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'ContestQuestion', required: true })
  questionId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: CODE_LANGUAGES, required: true })
  language: CodeLanguage;

  @Prop({ required: true })
  code: string;

  @Prop({ type: String, enum: SUBMISSION_STATUSES, default: 'queued' })
  status: SubmissionStatus;

  // True while queued or running, and unset after. A unique index on it
  // allows one waiting submission per entrant per contest.
  @Prop({ type: Boolean, default: true })
  pending?: true;

  @Prop({ default: 0 })
  attempts: number;

  // While running: when the judge's claim runs out and another may take it.
  @Prop({ type: Date, default: null })
  leaseUntil: Date | null;

  // One per hidden test, in the host's order. Never the test itself.
  @Prop({ type: [TestResultSchema], default: [] })
  verdicts: TestResult[];

  @Prop({ default: 0 })
  passed: number;

  @Prop({ default: 0 })
  total: number;

  @Prop({ default: 0 })
  points: number;

  @Prop({ type: Date, default: null })
  judgedAt: Date | null;

  createdAt: Date;
}

export const CodeSubmissionSchema =
  SchemaFactory.createForClass(CodeSubmission);
// The judge's queue: oldest first.
CodeSubmissionSchema.index({ status: 1, createdAt: 1 });
// An entrant's submissions to one question, newest first.
CodeSubmissionSchema.index({
  contestId: 1,
  userId: 1,
  questionId: 1,
  createdAt: -1,
});
// The per-minute limit counts an entrant's recent submissions.
CodeSubmissionSchema.index({ userId: 1, createdAt: -1 });
CodeSubmissionSchema.index(
  { contestId: 1, userId: 1, pending: 1 },
  { unique: true, partialFilterExpression: { pending: true } },
);
