import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  // Denormalized — stored at write time so history loads don't need
  // to populate 200 user refs just to display names in chat
  @Prop({ required: true })
  senderName: string;

  // text     → regular chat message
  // question → sent by interviewer, can be pinned
  // system   → automated e.g. "John joined the room"
  @Prop({ required: true, enum: ['text', 'question', 'system'], default: 'text' })
  type: string;

  @Prop({ required: true, trim: true })
  content: string;

  @Prop({ default: false })
  isPinned: boolean;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Compound index — the most common query is:
// "give me all messages in room X sorted by time"
// This index makes that query O(log n) instead of a full collection scan
MessageSchema.index({ roomId: 1, createdAt: 1 });