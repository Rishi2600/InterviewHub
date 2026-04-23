import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room, RoomDocument } from './schemas/room.schema';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomStateDto } from './dto/update-room-state.dto';
import { UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class RoomsService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
  ) {}

  // Generates a random 5-character uppercase join code e.g. "XK92T"
  // Called during room creation — retries if there's a collision (very rare)
  private generateCode(): string {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  }

  async create(dto: CreateRoomDto, creator: UserDocument): Promise<RoomDocument> {
    // Only interviewers can create rooms
    if (creator.role !== 'interviewer') {
      throw new ForbiddenException('Only interviewers can create rooms');
    }

    // Keep generating until we find a unique code
    // In practice this loop runs once — collisions are extremely rare
    let code: string;
    let exists = true;
    do {
      code = this.generateCode();
      exists = !!(await this.roomModel.findOne({ code }));
    } while (exists);

    const room = new this.roomModel({
      title: dto.title,
      code,
      createdBy: creator._id,
      contestId: dto.contestId
        ? new Types.ObjectId(dto.contestId)
        : null,
      // Creator is automatically added as the first participant
      participants: [
        {
          userId: creator._id,
          username: creator.username,
          role: creator.role,
        },
      ],
    });

    return room.save();
  }

  async findById(id: string): Promise<RoomDocument> {
    const room = await this.roomModel.findById(id).exec();
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async findByCode(code: string): Promise<RoomDocument> {
    const room = await this.roomModel
      .findOne({ code: code.toUpperCase() })
      .exec();
    if (!room) throw new NotFoundException('Room not found — check the code');
    return room;
  }

  // Called when a candidate enters the join code
  // Adds them to the participants array if not already in there
  async join(code: string, user: UserDocument): Promise<RoomDocument> {
    const room = await this.findByCode(code);

    if (room.status === 'ended') {
      throw new ForbiddenException('This session has already ended');
    }

    // Check if this user is already a participant
    // .toString() is needed because MongoDB ObjectIds are objects, not strings
    const alreadyIn = room.participants.some(
      (p) => p.userId.toString() === user._id.toString(),
    );

    if (alreadyIn) {
      // Don't throw — just return the room as-is
      // This handles reconnections gracefully
      return room;
    }

    // $push appends to the participants array atomically in MongoDB
    // We use findByIdAndUpdate instead of room.save() to avoid
    // race conditions if two users join at the exact same millisecond
    const updated = await this.roomModel.findByIdAndUpdate(
      room._id,
      {
        $push: {
          participants: {
            userId: user._id,
            username: user.username,
            role: user.role,
            joinedAt: new Date(),
          },
        },
      },
      { new: true }, // return the updated document, not the old one
    );

    return updated!;
  }

  // Only the room creator (interviewer) can change the state
  async changeState(
    id: string,
    dto: UpdateRoomStateDto,
    user: UserDocument,
  ): Promise<RoomDocument> {
    const room = await this.findById(id);

    if (room.createdBy.toString() !== user._id.toString()) {
      throw new ForbiddenException('Only the room creator can change room state');
    }

    room.status = dto.status;
    return room.save();
  }

  // Called by ChatService when a question is pinned
  // Stores the message _id as the pinned question reference
  async pinQuestion(
    roomId: string,
    messageId: string,
  ): Promise<RoomDocument> {
    const updated = await this.roomModel.findByIdAndUpdate(
      roomId,
      { pinnedQuestion: new Types.ObjectId(messageId) },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Room not found');
    return updated;
  }

  async unpinQuestion(roomId: string): Promise<RoomDocument> {
    const updated = await this.roomModel.findByIdAndUpdate(
      roomId,
      { pinnedQuestion: null },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Room not found');
    return updated;
  }
}