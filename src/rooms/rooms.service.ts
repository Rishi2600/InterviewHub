import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomInt } from 'crypto';
import { Model, Types } from 'mongoose';
import { Subject } from 'rxjs';
import {
  ROOM_STATES,
  Room,
  RoomDocument,
  RoomState,
} from './schemas/room.schema';
import { ListRoomsDto } from './dto/list-rooms.dto';
import { ActivityEvent } from '../activity/schemas/activity-event.schema';
import {
  NEWEST_FIRST,
  Page,
  countByStatePipeline,
  pageQuery,
  toPage,
} from '../common/pagination/pagination';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
const CODE_LENGTH = 5;
// Codes are only ever made from CODE_ALPHABET, so anything else cannot exist.
const ROOM_CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);
// Caps the list endpoint so a long-lived account cannot pull an unbounded set.

@Injectable()
export class RoomsService {
  /** Ids of rooms as they end, so the room's sockets can be told. */
  readonly ended$ = new Subject<string>();

  constructor(
    @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
    @InjectModel(ActivityEvent.name)
    private readonly eventModel: Model<ActivityEvent>,
  ) {}

  private generateCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
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
   * Rooms the user owns or has joined, newest first, one page at a time.
   * Scoped to the caller: there is deliberately no "all rooms" listing.
   */
  async listForUser(
    user: { userId: string },
    query: ListRoomsDto = {},
  ): Promise<Page<RoomDocument>> {
    const uid = new Types.ObjectId(user.userId);
    const scope = { $or: [{ ownerId: uid }, { 'participants.userId': uid }] };
    const { conditions, limit, fetch } = pageQuery(scope, query);
    const [rows, grouped] = await Promise.all([
      this.roomModel.find(conditions).sort(NEWEST_FIRST).limit(fetch).exec(),
      this.roomModel
        .aggregate<{ _id: string; n: number }>(countByStatePipeline(scope))
        .exec(),
    ]);
    return toPage(rows, limit, grouped, ROOM_STATES);
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
   * Records that a user has been announced in a room. True only the first
   * time, so the "joined" message is posted once per user, not on every
   * reconnect or visit. Atomic, so two tabs cannot both post it.
   */
  async markAnnounced(roomId: string, userId: string): Promise<boolean> {
    const uid = new Types.ObjectId(userId);
    const result = await this.roomModel
      .updateOne(
        { _id: roomId, announcedUserIds: { $ne: uid } },
        { $addToSet: { announcedUserIds: uid } },
      )
      .exec();
    return result.modifiedCount === 1;
  }

  /** A room the user may read. Anyone else gets the same 404 as a missing
   *  room, so ids cannot be probed. */
  async findForMember(
    id: string,
    user: { userId: string; role: string },
  ): Promise<RoomDocument> {
    const room = await this.findByIdRaw(id);
    if (!room || !this.isMember(room, user)) {
      throw new NotFoundException('Room not found');
    }
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
    const normalized = code.toUpperCase();
    if (!ROOM_CODE_PATTERN.test(normalized)) {
      throw new NotFoundException('Room not found');
    }
    const room = await this.roomModel.findOne({ code: normalized }).exec();
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
    if (state === 'ended') room.endedAt = new Date();
    const saved = await room.save();
    if (state === 'ended') {
      await this.recordInterview(saved, new Date());
      this.ended$.next(saved.id);
    }
    return saved;
  }

  /**
   * One activity event for each candidate who joined, which puts a square on
   * their contribution graph. Interviewers don't get one. The unique index
   * on (kind, refId, userId) makes a repeat land on the same row.
   */
  private async recordInterview(room: RoomDocument, at: Date): Promise<void> {
    const candidates = room.participants.filter((p) => p.role === 'candidate');
    if (candidates.length === 0) return;
    await this.eventModel.bulkWrite(
      candidates.map((p) => ({
        updateOne: {
          filter: { kind: 'interview', refId: room._id, userId: p.userId },
          update: { $set: { at, data: { title: room.title } } },
          upsert: true,
        },
      })),
    );
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
