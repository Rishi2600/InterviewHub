import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room, RoomDocument, RoomState } from './schemas/room.schema';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
const CODE_LENGTH = 5;
// Caps the list endpoint so a long-lived account cannot pull an unbounded set.
const LIST_LIMIT = 50;

@Injectable()
export class RoomsService {
  constructor(
    @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
  ) {}

  private generateCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
  }

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = this.generateCode();
      const exists = await this.roomModel.exists({ code });
      if (!exists) return code;
    }
    throw new BadRequestException('Could not generate a unique room code');
  }

  async create(ownerId: string, title: string): Promise<RoomDocument> {
    const code = await this.generateUniqueCode();
    const room = new this.roomModel({
      title,
      code,
      ownerId: new Types.ObjectId(ownerId),
      state: 'waiting',
      participants: [],
    });
    return room.save();
  }

  /**
   * Rooms the user owns or has joined, most recently updated first. Scoped to
   * the caller: there is deliberately no "all rooms" listing.
   */
  listForUser(user: { userId: string }): Promise<RoomDocument[]> {
    if (!Types.ObjectId.isValid(user.userId)) return Promise.resolve([]);
    const uid = new Types.ObjectId(user.userId);
    return this.roomModel
      .find({ $or: [{ ownerId: uid }, { 'participants.userId': uid }] })
      .sort({ updatedAt: -1 })
      .limit(LIST_LIMIT)
      .exec();
  }

  /** Used by guards; returns the raw doc (or null) without throwing. */
  findByIdRaw(id: string): Promise<RoomDocument | null> {
    if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return this.roomModel.findById(id).exec();
  }

  async findById(id: string): Promise<RoomDocument> {
    const room = await this.findByIdRaw(id);
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  /**
   * The single ownership rule for rooms: the creator, or any admin. Shared by
   * RoomOwnerGuard (HTTP) and ChatGateway (WebSocket) so both transports agree
   * on who may mutate a room.
   */
  isOwnedBy(
    room: RoomDocument,
    user: { userId: string; role: string },
  ): boolean {
    if (user.role === 'admin') return true;
    return room.ownerId.toString() === user.userId;
  }

  /**
   * Who may read and post in a room: its owner, any admin, or a participant
   * (someone who joined with the room code over HTTP).
   */
  isMember(
    room: RoomDocument,
    user: { userId: string; role: string },
  ): boolean {
    return (
      this.isOwnedBy(room, user) ||
      room.participants.some((p) => p.userId.toString() === user.userId)
    );
  }

  async findByCode(code: string): Promise<RoomDocument> {
    const room = await this.roomModel
      .findOne({ code: code.toUpperCase() })
      .exec();
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async joinByCode(
    code: string,
    user: { userId: string; username: string; role: string },
  ): Promise<RoomDocument> {
    const room = await this.findByCode(code);
    if (room.state === 'ended') {
      throw new BadRequestException('Room has ended');
    }

    const already = room.participants.some(
      (p) => p.userId.toString() === user.userId,
    );
    if (!already) {
      room.participants.push({
        userId: new Types.ObjectId(user.userId),
        username: user.username,
        role: user.role,
        joinedAt: new Date(),
      });
      await room.save();
    }
    return room;
  }

  private canTransition(from: RoomState, to: RoomState): boolean {
    const allowed: Record<RoomState, RoomState[]> = {
      waiting: ['active', 'ended'],
      active: ['ended'],
      ended: [],
    };
    return allowed[from].includes(to);
  }

  async setState(id: string, state: RoomState): Promise<RoomDocument> {
    const room = await this.findById(id);
    if (room.state === state) return room;
    if (!this.canTransition(room.state, state)) {
      throw new BadRequestException(
        `Invalid state transition: ${room.state} -> ${state}`,
      );
    }
    room.state = state;
    return room.save();
  }

  async pinQuestion(id: string, question: string): Promise<RoomDocument> {
    const room = await this.findById(id);
    room.pinnedQuestion = question;
    return room.save();
  }

  async unpinQuestion(id: string): Promise<RoomDocument> {
    const room = await this.findById(id);
    room.pinnedQuestion = null;
    return room.save();
  }
}
