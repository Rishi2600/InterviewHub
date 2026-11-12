import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type PrepProfileDocument = HydratedDocument<PrepProfile>;

/** A candidate's own prep choices: the topics they pinned as focus. */
@Schema({ timestamps: true, collection: 'prep_profiles' })
export class PrepProfile {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  })
  userId: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  focus: string[];
}

export const PrepProfileSchema = SchemaFactory.createForClass(PrepProfile);
