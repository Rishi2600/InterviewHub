import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type ActivityEventDocument = HydratedDocument<ActivityEvent>;
export const ACTIVITY_KINDS = [
  'contest',
  'interview',
  'prep',
  'dummy',
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/**
 * One thing a user did, such as finishing a contest. Feeds the candidate
 * score, the contribution graph and activity-based prep.
 */
@Schema({ timestamps: true, collection: 'activity_events' })
export class ActivityEvent {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: ACTIVITY_KINDS, required: true })
  kind: ActivityKind;

  // The contest, interview or session the event is about.
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  refId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  at: Date;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  data: Record<string, unknown>;
}

export const ActivityEventSchema = SchemaFactory.createForClass(ActivityEvent);
// One event per user per thing, so writing it again updates the same row.
ActivityEventSchema.index({ kind: 1, refId: 1, userId: 1 }, { unique: true });
ActivityEventSchema.index({ userId: 1, at: -1 });
