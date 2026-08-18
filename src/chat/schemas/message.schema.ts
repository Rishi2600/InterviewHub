import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;
export type MessageType = 'user' | 'system';

@Schema({ timestamps: true, collection: 'messages' })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  senderId: Types.ObjectId | null;

  // Denormalized at write time so history loads never populate user refs.
  @Prop({ default: 'system' })
  senderName: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: String, enum: ['user', 'system'], default: 'user' })
  type: MessageType;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Compound index: fetch a room's messages in chronological order efficiently.
MessageSchema.index({ roomId: 1, createdAt: 1 });
