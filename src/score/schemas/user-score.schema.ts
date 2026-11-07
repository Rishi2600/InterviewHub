import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { BADGE_IDS, type BadgeId } from '../score-formula';

export type UserScoreDocument = HydratedDocument<UserScore>;

@Schema({ _id: false })
export class ScorePoint {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  contestId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  at: Date;

  @Prop({ required: true })
  score: number;
}

@Schema({ _id: false })
export class StoredBadge {
  @Prop({ type: String, enum: BADGE_IDS, required: true })
  id: BadgeId;

  @Prop({ required: true })
  count: number;

  @Prop({ type: Date, default: null })
  earnedAt: Date | null;

  @Prop({ required: true })
  progress: number;

  @Prop({ required: true })
  goal: number;
}

@Schema({ _id: false })
export class ScoreFormula {
  @Prop({ required: true })
  weightedSum: number;

  @Prop({ required: true })
  weightTotal: number;

  @Prop({ required: true })
  multiplier: number;

  // Submitted contests out of `window` rated ones.
  @Prop({ required: true })
  submitted: number;

  @Prop({ required: true })
  window: number;
}

/**
 * A candidate's score, worked out from their contest activity events each
 * time a contest they started is finalized. Everything here can be rebuilt
 * from those events, so writing it again gives the same document.
 */
@Schema({ timestamps: true, collection: 'user_scores' })
export class UserScore {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  // Null before the first rated contest.
  @Prop({ type: Number, default: null })
  score: number | null;

  @Prop({ default: true })
  provisional: boolean;

  @Prop({ type: SchemaFactory.createForClass(ScoreFormula), default: null })
  formula: ScoreFormula | null;

  @Prop({ default: 0 })
  ratedCount: number;

  // Contests started; joined but never started does not count.
  @Prop({ default: 0 })
  enteredCount: number;

  @Prop({ type: Date, default: null })
  lastActiveAt: Date | null;

  // Score after each rated contest, oldest first.
  @Prop({ type: [SchemaFactory.createForClass(ScorePoint)], default: [] })
  history: ScorePoint[];

  @Prop({ type: [SchemaFactory.createForClass(StoredBadge)], default: [] })
  badges: StoredBadge[];

  @Prop({ type: Date, required: true })
  computedAt: Date;
}

export const UserScoreSchema = SchemaFactory.createForClass(UserScore);
UserScoreSchema.index({ userId: 1 }, { unique: true });
