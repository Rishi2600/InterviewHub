import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type HostUsageDocument = HydratedDocument<HostUsage>;

/** Contests a host published in one calendar month (UTC), for the free limit. */
@Schema({ timestamps: true, collection: 'host_usage' })
export class HostUsage {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  hostId: Types.ObjectId;

  // 'YYYY-MM' in UTC.
  @Prop({ required: true })
  month: string;

  @Prop({ default: 0 })
  published: number;
}

export const HostUsageSchema = SchemaFactory.createForClass(HostUsage);
HostUsageSchema.index({ hostId: 1, month: 1 }, { unique: true });
