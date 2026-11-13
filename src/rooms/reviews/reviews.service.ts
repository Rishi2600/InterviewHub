import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { feedbackAreas, TOPICS } from '../../practice/practice.constants';
import { SaveReviewDto } from '../dto/save-review.dto';
import { RoomsService } from '../rooms.service';
import { RoomReview } from '../schemas/room-review.schema';
import { RoomDocument } from '../schemas/room.schema';

/** Reviews can be written and changed this long after the room ends. */
export const REVIEW_OPEN_MS = 7 * 24 * 60 * 60_000;

type Stored = RoomReview & { _id: Types.ObjectId };

/**
 * Interviewers' reviews of candidates after a live interview. A review is
 * seen by its candidate and its reviewer only, and changes no score.
 */
@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(RoomReview.name) private readonly model: Model<RoomReview>,
    private readonly rooms: RoomsService,
  ) {}

  /**
   * The room's reviews for this member. A reviewer gets the candidates and
   * their own reviews; a candidate gets the reviews about them.
   */
  async forRoom(roomId: string, user: AuthUser, now = new Date()) {
    const room = await this.rooms.findForMember(roomId, user);
    const closesAt = closes(room);
    const open = !!closesAt && now < closesAt;
    if (isReviewer(room, user)) {
      const mine = await this.model
        .find({ roomId: room._id, reviewerId: oid(user.userId) })
        .lean()
        .exec();
      return {
        role: 'reviewer' as const,
        ended: room.state === 'ended',
        open,
        closesAt,
        candidates: candidates(room).map((p) => ({
          userId: p.userId.toString(),
          username: p.username,
        })),
        reviews: mine.map(reviewView),
      };
    }
    const about = await this.model
      .find({ roomId: room._id, candidateId: oid(user.userId) })
      .lean()
      .exec();
    return {
      role: 'candidate' as const,
      ended: room.state === 'ended',
      open,
      closesAt,
      candidates: [],
      reviews: about.map(reviewView),
    };
  }

  /** Writes or changes this reviewer's review of one candidate. */
  async save(
    roomId: string,
    candidateId: string,
    user: AuthUser,
    dto: SaveReviewDto,
    now = new Date(),
  ) {
    const room = await this.rooms.findForMember(roomId, user);
    if (!isReviewer(room, user)) {
      throw new ForbiddenException('Only interviewers in the room can review');
    }
    const closesAt = closes(room);
    if (!closesAt) {
      throw new BadRequestException('Reviews open when the room ends');
    }
    if (now >= closesAt) {
      throw new BadRequestException('Reviews for this room have closed');
    }
    const candidate = candidates(room).find(
      (p) => p.userId.toString() === candidateId,
    );
    if (!candidate) throw new NotFoundException('Candidate not found');

    const topics = [...new Set(dto.topics)];
    if (topics.some((t) => !TOPICS[dto.kind].includes(t))) {
      throw new BadRequestException(`Unknown topic for a ${dto.kind} review`);
    }
    const allowed = new Set([
      ...feedbackAreas(dto.kind, true),
      ...feedbackAreas(dto.kind, false),
    ]);
    const names = dto.areas.map((a) => a.name);
    if (names.some((n) => !allowed.has(n))) {
      throw new BadRequestException(`Unknown area for a ${dto.kind} review`);
    }
    if (new Set(names).size !== names.length) {
      throw new BadRequestException('Each area at most once');
    }

    const saved = await this.model
      .findOneAndUpdate(
        {
          roomId: room._id,
          reviewerId: oid(user.userId),
          candidateId: candidate.userId,
        },
        {
          $set: {
            roomTitle: room.title,
            reviewerName: user.username,
            kind: dto.kind,
            topics,
            areas: dto.areas.map((a) => ({ name: a.name, score: a.score })),
            note: dto.note?.trim() ?? '',
          },
        },
        { upsert: true, returnDocument: 'after' },
      )
      .lean()
      .exec();
    return reviewView(saved);
  }

  /** Every review about this candidate, newest first. */
  async mine(user: AuthUser) {
    const rows = await this.model
      .find({ candidateId: oid(user.userId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .exec();
    return rows.map(reviewView);
  }

  /** Reviews about a candidate since a date, for prep's weak areas. */
  since(candidateId: Types.ObjectId, since: Date) {
    return this.model
      .find({ candidateId, createdAt: { $gte: since } })
      .lean()
      .exec();
  }
}

const oid = (id: string) => new Types.ObjectId(id);

/** The room's owner, or an interviewer or admin who joined it. */
function isReviewer(room: RoomDocument, user: AuthUser): boolean {
  if (room.ownerId.toString() === user.userId) return true;
  return room.participants.some(
    (p) => p.userId.toString() === user.userId && p.role !== 'candidate',
  );
}

const candidates = (room: RoomDocument) =>
  room.participants.filter((p) => p.role === 'candidate');

/** When reviews close: a week after the end. Rooms ended before the end
 *  time was kept count from their last update. */
function closes(room: RoomDocument): Date | null {
  if (room.state !== 'ended') return null;
  const ended = room.endedAt ?? room.updatedAt;
  return new Date(ended.getTime() + REVIEW_OPEN_MS);
}

function reviewView(r: Stored) {
  return {
    id: r._id.toString(),
    roomId: r.roomId.toString(),
    roomTitle: r.roomTitle,
    reviewerId: r.reviewerId.toString(),
    reviewerName: r.reviewerName,
    candidateId: r.candidateId.toString(),
    kind: r.kind,
    topics: r.topics,
    areas: r.areas,
    note: r.note,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}
