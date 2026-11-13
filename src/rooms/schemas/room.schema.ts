import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type RoomDocument = HydratedDocument<Room>;
export const ROOM_STATES = ['waiting', 'active', 'ended'] as const;
export type RoomState = (typeof ROOM_STATES)[number];

@Schema({ _id: false })
export class Participant {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  username: string;

  @Prop({ required: true })
  role: string;

  @Prop({ default: () => new Date() })
  joinedAt: Date;
}
export const ParticipantSchema = SchemaFactory.createForClass(Participant);

@Schema({ timestamps: true, collection: 'rooms' })
export class Room {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  ownerId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ROOM_STATES,
    default: 'waiting',
  })
  state: RoomState;

  @Prop({ type: [ParticipantSchema], default: [] })
  participants: Participant[];

  @Prop({ type: String, default: null })
  pinnedQuestion: string | null;

  // When the room ended; reviews are open for a while after it.
  @Prop({ type: Date, default: null })
  endedAt: Date | null;

  // Users already announced with "joined the room". Internal, never returned.
  @Prop({ type: [SchemaTypes.ObjectId], default: [], select: false })
  announcedUserIds: Types.ObjectId[];

  createdAt: Date;
  updatedAt: Date;
}

export const RoomSchema = SchemaFactory.createForClass(Room);
// "Rooms I joined" lookups, and newest-first paging of both halves of the list.
RoomSchema.index({ ownerId: 1, createdAt: -1 });
RoomSchema.index({ 'participants.userId': 1, createdAt: -1 });
