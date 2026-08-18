import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ContestDocument = HydratedDocument<Contest>;
export type ContestState = 'draft' | 'active' | 'ended';

@Schema({ timestamps: true, collection: 'contests' })
export class Contest {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ type: String, enum: ['draft', 'active', 'ended'], default: 'draft' })
  state: ContestState;

  @Prop({ type: Date, default: null })
  endedAt: Date | null;
}

export const ContestSchema = SchemaFactory.createForClass(Contest);
