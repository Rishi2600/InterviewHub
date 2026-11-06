import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CONTEST_STATUSES,
  ContestDocument,
  Contest,
} from './schemas/contest.schema';
import { ListContestsDto } from './dto/list-contests.dto';
import {
  NEWEST_FIRST,
  Page,
  countByStatePipeline,
  pageQuery,
  toPage,
} from '../common/pagination/pagination';
import {
  ContestEntry,
  ContestEntryDocument,
} from './schemas/contest-entry.schema';
import { isDuplicateKey } from '../common/mongo-errors';

interface Caller {
  userId: string;
  role: string;
}

@Injectable()
export class ContestsService {
  constructor(
    @InjectModel(Contest.name)
    private readonly contestModel: Model<ContestDocument>,
    @InjectModel(ContestEntry.name)
    private readonly entryModel: Model<ContestEntryDocument>,
  ) {}

  /**
   * Contests the user hosts or has joined, newest first, one page at a time.
   * The public list for the browse page is separate.
   */
  async listForUser(
    user: { userId: string },
    query: ListContestsDto = {},
  ): Promise<Page<ContestDocument>> {
    const uid = new Types.ObjectId(user.userId);
    const entries = await this.entryModel
      .find({ userId: uid })
      .select('contestId')
      .lean()
      .exec();
    const joinedIds = entries.map((e) => e.contestId);

    const scope = { $or: [{ hostId: uid }, { _id: { $in: joinedIds } }] };
    const { conditions, limit, fetch } = pageQuery(scope, query, 'status');
    const [rows, grouped] = await Promise.all([
      this.contestModel.find(conditions).sort(NEWEST_FIRST).limit(fetch).exec(),
      this.contestModel
        .aggregate<{
          _id: string;
          n: number;
        }>(countByStatePipeline(scope, 'status'))
        .exec(),
    ]);
    return toPage(rows, limit, grouped, CONTEST_STATUSES);
  }

  async findById(id: string): Promise<ContestDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Contest not found');
    const contest = await this.contestModel.findById(id).exec();
    if (!contest) throw new NotFoundException('Contest not found');
    return contest;
  }

  isHost(contest: ContestDocument, user: Caller): boolean {
    return user.role === 'admin' || contest.hostId.toString() === user.userId;
  }

  /** A contest the user may see. Drafts are visible to their host and admins
   *  only; anyone else gets the same 404 as a missing contest. */
  async findVisible(id: string, user: Caller): Promise<ContestDocument> {
    const contest = await this.findById(id);
    if (contest.status === 'draft' && !this.isHost(contest, user)) {
      throw new NotFoundException('Contest not found');
    }
    return contest;
  }

  /**
   * Joins a published contest before its end. Capacity is checked and the
   * entrant count raised in one atomic update, so a full contest can never
   * take one more. Joining twice returns the existing entry.
   */
  async join(
    id: string,
    user: Caller & { username: string },
    now = new Date(),
  ): Promise<ContestEntryDocument> {
    const contest = await this.findVisible(id, user);
    if (contest.hostId.toString() === user.userId) {
      throw new ForbiddenException('You cannot enter your own contest');
    }
    const userId = new Types.ObjectId(user.userId);
    const existing = await this.entryModel
      .findOne({ contestId: contest._id, userId })
      .exec();
    if (existing) return existing;

    const taken = await this.contestModel
      .findOneAndUpdate(
        {
          _id: contest._id,
          status: 'published',
          endAt: { $gt: now },
          $or: [
            { capacity: null },
            { $expr: { $lt: ['$entrantCount', '$capacity'] } },
          ],
        },
        { $inc: { entrantCount: 1 } },
      )
      .exec();
    if (!taken) throw new BadRequestException(this.whyClosed(contest, now));

    try {
      return await this.entryModel.create({
        contestId: contest._id,
        userId,
        username: user.username,
        joinedAt: now,
      });
    } catch (err) {
      // A second join raced this one: give the place back, keep theirs.
      if (!isDuplicateKey(err)) throw err;
      await this.contestModel
        .updateOne({ _id: contest._id }, { $inc: { entrantCount: -1 } })
        .exec();
      return this.entryModel
        .findOne({ contestId: contest._id, userId })
        .orFail()
        .exec();
    }
  }

  private whyClosed(contest: ContestDocument, now: Date): string {
    if (contest.status === 'cancelled') return 'Contest was cancelled';
    if (contest.endAt && contest.endAt <= now) return 'Contest has ended';
    return 'Contest is full';
  }

  /** Final standings, best first, once the contest is finalized. */
  async results(id: string, user: Caller): Promise<ContestEntryDocument[]> {
    const contest = await this.findVisible(id, user);
    if (!contest.finalizedAt) {
      throw new BadRequestException('Results are not ready yet');
    }
    return this.entryModel
      .find({ contestId: contest._id, rank: { $ne: null } })
      .select('-answers')
      .sort({ rank: 1, username: 1 })
      .exec();
  }
}
