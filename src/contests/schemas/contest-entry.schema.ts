import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type ContestEntryDocument = HydratedDocument<ContestEntry>;

@Schema({ timestamps: true, collection: 'contest_entries' })
export class ContestEntry {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Contest',
    required: true,
    index: true,
  })
  contestId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  username: string;

  // Final score, synced from the leaderboard when the contest ends.
  @Prop({ default: 0 })
  finalScore: number;

  @Prop({ default: 0 })
  finalRank: number;
}

export const ContestEntrySchema = SchemaFactory.createForClass(ContestEntry);
// One entry per (contest, user).
ContestEntrySchema.index({ contestId: 1, userId: 1 }, { unique: true });
