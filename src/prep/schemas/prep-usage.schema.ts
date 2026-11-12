import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type PrepUsageDocument = HydratedDocument<PrepUsage>;

/** Drills and coach sessions a candidate started on one UTC day. */
@Schema({ timestamps: true, collection: 'prep_usage' })
export class PrepUsage {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  // 'YYYY-MM-DD' in UTC.
  @Prop({ required: true })
  day: string;

  @Prop({ default: 0 })
  drill: number;

  @Prop({ default: 0 })
  coach: number;
}

export const PrepUsageSchema = SchemaFactory.createForClass(PrepUsage);
PrepUsageSchema.index({ userId: 1, day: 1 }, { unique: true });
