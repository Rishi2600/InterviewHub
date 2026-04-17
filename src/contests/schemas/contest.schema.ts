import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ContestDocument = Contest & Document;

@Schema({ timestamps: true })
export class Contest {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  // All rooms that belong to this contest
  // Each room hosts one candidate + one interviewer
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Room' }], default: [] })
  roomIds: Types.ObjectId[];

  @Prop({
    required: true,
    enum: ['upcoming', 'active', 'ended'],
    default: 'upcoming',
  })
  status: string;

  @Prop({ required: true })
  startAt: Date;

  @Prop({ required: true })
  endAt: Date;
}

export const ContestSchema = SchemaFactory.createForClass(Contest);

ContestSchema.index({ status: 1 });