import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import {
  PRACTICE_KINDS,
  type PracticeKind,
} from '../../practice/practice.constants';

export type RoomReviewDocument = HydratedDocument<RoomReview>;

@Schema({ _id: false })
export class ReviewArea {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, min: 1, max: 5 })
  score: number;
}

/**
 * An interviewer's review of one candidate after a live interview. Seen only
 * by that candidate and the reviewer; no effect on the candidate score. It
 * feeds the candidate's prep suggestions. One per room, reviewer and
 * candidate; editable for a while after the room ends.
 */
@Schema({ timestamps: true, collection: 'room_reviews' })
export class RoomReview {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;

  // Denormalised so the candidate's list needs no room lookups.
  @Prop({ required: true })
  roomTitle: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  reviewerId: Types.ObjectId;

  @Prop({ required: true })
  reviewerName: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  candidateId: Types.ObjectId;

  @Prop({ type: String, enum: PRACTICE_KINDS, required: true })
  kind: PracticeKind;

  @Prop({ type: [String], required: true })
  topics: string[];

  @Prop({ type: [ReviewArea], required: true })
  areas: ReviewArea[];

  @Prop({ default: '' })
  note: string;

  createdAt: Date;
  updatedAt: Date;
}

export const RoomReviewSchema = SchemaFactory.createForClass(RoomReview);
RoomReviewSchema.index(
  { roomId: 1, reviewerId: 1, candidateId: 1 },
  { unique: true },
);
RoomReviewSchema.index({ candidateId: 1, createdAt: -1 });
