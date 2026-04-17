//@ts-nocheck

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoomDocument = Room & Document;

// Embedded sub-document — not a separate collection
// Lives inside every room as an array
@Schema({ _id: false }) // no separate _id for sub-docs
export class Participant {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  username: string; // denormalized — avoids populating User on every WS event

  @Prop({ required: true, enum: ['candidate', 'interviewer'] })
  role: string;

  @Prop({ default: Date.now })
  joinedAt: Date;
}

export const ParticipantSchema = SchemaFactory.createForClass(Participant);

@Schema({ timestamps: true })
export class Room {
  @Prop({ required: true, trim: true })
  title: string;

  // Short join code — e.g. "XK92T" — shared with candidates out of band
  @Prop({ required: true, unique: true, uppercase: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: [ParticipantSchema], default: [] })
  participants: Participant[];

  @Prop({
    required: true,
    enum: ['waiting', 'active', 'ended'],
    default: 'waiting',
  })
  status: string;

  // The _id of the currently pinned message (question)
  // null means no question is pinned right now
  @Prop({ type: Types.ObjectId, ref: 'Message', default: null })
  pinnedQuestion: Types.ObjectId | null;

  // Optional — set when this room is part of a contest
  @Prop({ type: Types.ObjectId, ref: 'Contest', default: null })
  contestId: Types.ObjectId | null;
}

export const RoomSchema = SchemaFactory.createForClass(Room);

// Index on code for fast lookups when a candidate joins via join code
RoomSchema.index({ code: 1 });

// Index on contestId for fetching all rooms in a contest
RoomSchema.index({ contestId: 1 });