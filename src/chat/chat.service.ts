import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { SendMessageDto } from './dto/send-message.dto';
import { UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  // Persists a message to MongoDB
  // senderName is denormalized here — stored with the message so
  // history loads don't need to populate user refs for every message
  async saveMessage(
    dto: SendMessageDto,
    sender: UserDocument,
  ): Promise<MessageDocument> {
    const message = new this.messageModel({
      roomId: new Types.ObjectId(dto.roomId),
      senderId: sender._id,
      senderName: sender.username,
      type: dto.type,
      content: dto.content,
      isPinned: false,
    });

    return message.save();
  }

  // Loads message history for a room when a user joins
  // Uses the compound index { roomId, createdAt } for fast retrieval
  // limit defaults to 50 — enough for context without hammering the DB
  async getHistory(
    roomId: string,
    limit = 50,
  ): Promise<MessageDocument[]> {
    return this.messageModel
      .find({ roomId: new Types.ObjectId(roomId) })
      .sort({ createdAt: 1 }) // oldest first — natural chat order
      .limit(limit)
      .exec();
  }

  // Pins a question — marks the message as pinned in MongoDB
  // and returns it so the gateway can broadcast it to the room
  async pinQuestion(messageId: string): Promise<MessageDocument> {
    // First unpin any currently pinned message in this room
    // Only one question should be pinned at a time
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Message not found');

    // Unpin all other messages in this room first
    await this.messageModel.updateMany(
      { roomId: message.roomId, isPinned: true },
      { isPinned: false },
    );

    // Pin the new one
    message.isPinned = true;
    return message.save();
  }

  async unpinQuestion(roomId: string): Promise<void> {
    await this.messageModel.updateMany(
      { roomId: new Types.ObjectId(roomId), isPinned: true },
      { isPinned: false },
    );
  }

  // Saves a system message — e.g. "Alice joined the room"
  // These are created by the gateway, not by users directly
  async saveSystemMessage(
    roomId: string,
    content: string,
  ): Promise<MessageDocument> {
    const message = new this.messageModel({
      roomId: new Types.ObjectId(roomId),
      senderId: new Types.ObjectId(), // placeholder — system has no real user
      senderName: 'System',
      type: 'system',
      content,
      isPinned: false,
    });

    return message.save();
  }
}