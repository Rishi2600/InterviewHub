import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Message,
  MessageDocument,
  MessageType,
} from './schemas/message.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
  ) {}

  create(input: {
    roomId: string;
    senderId: string | null;
    senderName: string;
    content: string;
    type?: MessageType;
  }): Promise<MessageDocument> {
    return this.messageModel.create({
      roomId: new Types.ObjectId(input.roomId),
      senderId: input.senderId ? new Types.ObjectId(input.senderId) : null,
      senderName: input.senderName,
      content: input.content,
      type: input.type ?? 'user',
    });
  }

  /** Chronological history for a room, capped to the most recent `limit`. */
  async history(roomId: string, limit = 100): Promise<MessageDocument[]> {
    if (!Types.ObjectId.isValid(roomId)) return [];
    const docs = await this.messageModel
      .find({ roomId: new Types.ObjectId(roomId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
    return docs.reverse();
  }
}
