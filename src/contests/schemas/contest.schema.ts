import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type ContestDocument = HydratedDocument<Contest>;
export const CONTEST_STATUSES = ['draft', 'published', 'cancelled'] as const;
export type ContestStatus = (typeof CONTEST_STATUSES)[number];

/**
 * A quiz contest. Upcoming, live and ended are worked out from the clock and
 * `startAt`/`endAt`, not stored. Questions live in `contest_questions`.
 */
@Schema({ timestamps: true, collection: 'contests' })
export class Contest {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  hostId: Types.ObjectId;

  @Prop({ required: true })
  hostName: string;

  @Prop({ type: String, enum: CONTEST_STATUSES, default: 'draft' })
  status: ContestStatus;

  @Prop({ type: String, default: 'quiz' })
  format: 'quiz';

  // Null on a draft until the host picks them.
  @Prop({ type: Date, default: null })
  startAt: Date | null;

  @Prop({ type: Date, default: null })
  endAt: Date | null;

  // Null means anyone can join.
  @Prop({ type: Number, default: null })
  capacity: number | null;

  @Prop({ default: 0 })
  questionCount: number;

  @Prop({ default: 0 })
  entrantCount: number;

  @Prop({ default: 0 })
  startedCount: number;

  @Prop({ default: 0 })
  submittedCount: number;

  @Prop({ type: Date, default: null })
  publishedAt: Date | null;

  @Prop({ type: Date, default: null })
  cancelledAt: Date | null;

  // Set once results are scored and ranked.
  @Prop({ type: Date, default: null })
  finalizedAt: Date | null;

  // Lease held by the server finalizing the contest; see the finalize job.
  @Prop({ type: Date, default: null })
  lockedUntil: Date | null;

  // Decided at finalize; null until then.
  @Prop({ type: Boolean, default: null })
  rated: boolean | null;

  createdAt: Date;
}

export const ContestSchema = SchemaFactory.createForClass(Contest);
ContestSchema.index({ status: 1, startAt: 1 });
ContestSchema.index({ hostId: 1, createdAt: -1 });
ContestSchema.index({ title: 'text' });
// The finalize job's query: published, ended, not yet finalized.
ContestSchema.index({ status: 1, finalizedAt: 1, endAt: 1 });
