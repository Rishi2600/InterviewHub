import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type ContestDocument = HydratedDocument<Contest>;
export const CONTEST_STATES = ['draft', 'active', 'ended'] as const;
export type ContestState = (typeof CONTEST_STATES)[number];

@Schema({ timestamps: true, collection: 'contests' })
export class Contest {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  ownerId: Types.ObjectId;

  @Prop({ type: String, enum: CONTEST_STATES, default: 'draft' })
  state: ContestState;

  @Prop({ type: Date, default: null })
  endedAt: Date | null;

  createdAt: Date;
}

export const ContestSchema = SchemaFactory.createForClass(Contest);
ContestSchema.index({ ownerId: 1, createdAt: -1 });
