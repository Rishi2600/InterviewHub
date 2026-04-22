//@ts-nocheck

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ContestEntryDocument = ContestEntry & Document;

@Schema({ timestamps: true })
export class ContestEntry {

  @Prop({ type: Types.ObjectId, ref: 'Contest', required: true })
  contestId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  // Denormalized for fast leaderboard reads from MongoDB
  @Prop({ required: true })
  username: string;

  // Live score is stored in Redis during the contest
  // This field is only populated when the contest ends
  // (synced from Redis ZREVRANGE at contest end)
  @Prop({ default: 0 })
  score: number;

  // Final rank computed when contest ends
  // Must use { type: Number } explicitly — Mongoose cannot infer
  // the type from a TypeScript union (number | null)
  @Prop({ type: Number, default: null })
  rank: number | null;

  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;
}

export const ContestEntrySchema = SchemaFactory.createForClass(ContestEntry);

// Compound unique index — one entry per user per contest
ContestEntrySchema.index({ contestId: 1, userId: 1 }, { unique: true });

// For fetching all entries in a contest sorted by score
ContestEntrySchema.index({ contestId: 1, score: -1 });