import {
  BadRequestException,
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
  DEFAULT_PAGE_SIZE,
  NEWEST_FIRST,
  Page,
  afterKeyCursor,
  countByStatePipeline,
  encodeKeyCursor,
  pageQuery,
  toPage,
} from '../common/pagination/pagination';
import { BrowseContestsDto, BrowsePhase } from './dto/browse-contests.dto';
import { CardViewer, ContestCard, toCard, toDetails } from './contest-views';
import {
  ContestEntry,
  ContestEntryDocument,
} from './schemas/contest-entry.schema';

interface Caller {
  userId: string;
  role: string;
}

/** How each browse tab filters and sorts. Live ends soonest first, upcoming
 *  starts soonest first, past ended most recently first. */
const BROWSE: Record<
  BrowsePhase,
  (now: Date) => {
    field: 'startAt' | 'endAt';
    direction: 1 | -1;
    filter: Record<string, unknown>;
  }
> = {
  live: (now) => ({
    field: 'endAt',
    direction: 1,
    filter: { startAt: { $lte: now }, endAt: { $gt: now } },
  }),
  upcoming: (now) => ({
    field: 'startAt',
    direction: 1,
    filter: { startAt: { $gt: now } },
  }),
  past: (now) => ({
    field: 'endAt',
    direction: -1,
    filter: { endAt: { $lte: now } },
  }),
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

  /**
   * The public browse list, one tab at a time. Drafts and cancelled contests
   * never appear. A signed-in viewer also sees which contests they host or
   * joined, and their rank on past ones.
   */
  async browse(
    query: BrowseContestsDto,
    user: Caller | null,
    now = new Date(),
  ): Promise<{
    items: ContestCard[];
    nextCursor: string | null;
    total: number;
  }> {
    const { field, direction, filter } = BROWSE[query.phase](now);
    const scope: Record<string, unknown> = { status: 'published', ...filter };
    if (query.q) {
      scope.title = { $regex: escapeRegex(query.q), $options: 'i' };
    }
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const conditions = query.cursor
      ? { $and: [scope, afterKeyCursor(field, query.cursor, direction)] }
      : scope;

    const [rows, total] = await Promise.all([
      this.contestModel
        .find(conditions)
        .sort({ [field]: direction, _id: direction })
        .limit(limit + 1)
        .lean()
        .exec(),
      this.contestModel.countDocuments(scope).exec(),
    ]);
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    const nextCursor =
      rows.length > limit && last[field]
        ? encodeKeyCursor(last[field], last._id)
        : null;
    const viewers = user ? await this.viewersOf(items, user) : null;
    return {
      items: items.map((c) =>
        toCard(c, now, viewers?.get(c._id.toString()) ?? null),
      ),
      nextCursor,
      total,
    };
  }

  /** Hosting, joined and rank for each contest on a page, in one query. */
  private async viewersOf(
    contests: { _id: Types.ObjectId; hostId: Types.ObjectId }[],
    user: Caller,
  ): Promise<Map<string, CardViewer>> {
    const userId = new Types.ObjectId(user.userId);
    const entries = await this.entryModel
      .find({ userId, contestId: { $in: contests.map((c) => c._id) } })
      .select('contestId rank')
      .lean()
      .exec();
    const byContest = new Map(entries.map((e) => [e.contestId.toString(), e]));
    return new Map(
      contests.map((c) => {
        const entry = byContest.get(c._id.toString());
        return [
          c._id.toString(),
          {
            hosting: c.hostId.equals(userId),
            joined: !!entry,
            rank: entry?.rank ?? null,
          },
        ];
      }),
    );
  }

  /** The details page: the contest, the viewer's own entry, and the top 3
   *  once results are out. No questions or answers. */
  async details(id: string, user: Caller, now = new Date()) {
    const contest = await this.findVisible(id, user);
    const userId = new Types.ObjectId(user.userId);
    const [entry, top] = await Promise.all([
      this.entryModel.findOne({ contestId: contest._id, userId }).lean().exec(),
      contest.finalizedAt
        ? this.entryModel
            .find({ contestId: contest._id, rank: { $ne: null } })
            .sort({ rank: 1, username: 1 })
            .limit(3)
            .select('username rank score timeUsedMs')
            .lean()
            .exec()
        : [],
    ]);
    return toDetails(
      contest.toObject(),
      now,
      {
        hosting: contest.hostId.equals(userId),
        canManage: this.isHost(contest, user),
      },
      entry,
      top,
    );
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
