import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type RoomDocument = HydratedDocument<Room>;
export type RoomState = 'waiting' | 'active' | 'ended';

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
    enum: ['waiting', 'active', 'ended'],
    default: 'waiting',
  })
  state: RoomState;

  @Prop({ type: [ParticipantSchema], default: [] })
  participants: Participant[];

  @Prop({ type: String, default: null })
  pinnedQuestion: string | null;

  // Users already announced with "joined the room". Internal, never returned.
  @Prop({ type: [SchemaTypes.ObjectId], default: [], select: false })
  announcedUserIds: Types.ObjectId[];
}

export const RoomSchema = SchemaFactory.createForClass(Room);
