import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { LEVELS, type Level } from '../../common/topics';

export type PrepDrillDocument = HydratedDocument<PrepDrill>;

@Schema({ _id: false })
export class DrillItem {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'PrepQuestion', required: true })
  questionId: Types.ObjectId;

  @Prop({ type: String, default: null })
  chosen: string | null;

  @Prop({ type: Boolean, default: null })
  correct: boolean | null;
}

/** One drill: up to 10 bank questions, answered in order. Private. */
@Schema({ timestamps: true, collection: 'prep_drills' })
export class PrepDrill {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  topic: string;

  @Prop({ type: String, enum: LEVELS, required: true })
  level: Level;

  @Prop({ type: [DrillItem], required: true })
  items: DrillItem[];

  @Prop({ type: String, enum: ['active', 'done'], default: 'active' })
  status: 'active' | 'done';

  // Set only while active: one active drill per candidate.
  @Prop({ type: Boolean })
  active?: true;

  @Prop({ default: 0 })
  answered: number;

  @Prop({ default: 0 })
  right: number;

  @Prop({ required: true })
  startedAt: Date;

  // The last answer, for closing drills left alone.
  @Prop({ required: true })
  lastAt: Date;

  @Prop({ type: Date, default: null })
  endedAt: Date | null;
}

export const PrepDrillSchema = SchemaFactory.createForClass(PrepDrill);
PrepDrillSchema.index(
  { userId: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
PrepDrillSchema.index({ userId: 1, startedAt: -1 });
PrepDrillSchema.index({ userId: 1, topic: 1, level: 1 });
