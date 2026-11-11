import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type PracticeUsageDocument = HydratedDocument<PracticeUsage>;

/** Practice interviews a candidate started in one month (UTC). */
@Schema({ timestamps: true, collection: 'practice_usage' })
export class PracticeUsage {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  // 'YYYY-MM' in UTC.
  @Prop({ required: true })
  month: string;

  @Prop({ default: 0 })
  started: number;
}

export const PracticeUsageSchema = SchemaFactory.createForClass(PracticeUsage);
PracticeUsageSchema.index({ userId: 1, month: 1 }, { unique: true });
