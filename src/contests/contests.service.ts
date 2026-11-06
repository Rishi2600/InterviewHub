import {
  BadRequestException,
  ConflictException,
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
  PageQueryDto,
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
import { ContestQuestion } from './schemas/contest-question.schema';
import { isCorrect } from './finalize/scoring';

// Rows of the board the results page shows before "Show all".
const RESULTS_TOP = 10;
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
    @InjectModel(ContestQuestion.name)
    private readonly questionModel: Model<ContestQuestion>,
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

  /** A finalized contest the user may see; results are hidden until then. */
  private async finalized(id: string, user: Caller): Promise<ContestDocument> {
    const contest = await this.findVisible(id, user);
    if (!contest.finalizedAt) {
      throw new ConflictException('Results are not ready yet');
    }
    return contest;
  }

  private board(contestId: Types.ObjectId) {
    return this.entryModel
      .find({ contestId, rank: { $ne: null } })
      .select('userId username rank score timeUsedMs autoSubmitted')
      .sort({ rank: 1, username: 1, _id: 1 });
  }

  /**
   * The results page: the top of the board, the viewer's own result, and
   * every question in the host's order with its answer key, explanation and
   * the viewer's picks. Hosts and admins also get how many got each right.
   */
  async results(id: string, user: Caller) {
    const contest = await this.finalized(id, user);
    const canManage = this.isHost(contest, user);
    const [top, mine, questions] = await Promise.all([
      this.board(contest._id).limit(RESULTS_TOP).lean().exec(),
      this.entryModel
        .findOne({
          contestId: contest._id,
          userId: new Types.ObjectId(user.userId),
        })
        .lean()
        .exec(),
      this.questionModel
        .find({ contestId: contest._id })
        .sort({ order: 1 })
        .lean()
        .exec(),
    ]);
    const picks = new Map(
      (mine?.answers ?? []).map((a) => [a.questionId.toString(), a.optionIds]),
    );
    return {
      contest: {
        _id: contest._id,
        title: contest.title,
        hostName: contest.hostName,
        endAt: contest.endAt,
        questionCount: contest.questionCount,
        totalPoints: contest.totalPoints,
        starters: contest.startedCount,
        rated: contest.rated,
      },
      top,
      me:
        mine && mine.rank !== null
          ? {
              rank: mine.rank,
              score: mine.score,
              timeUsedMs: mine.timeUsedMs,
              percentile: mine.percentile,
              autoSubmitted: mine.autoSubmitted,
            }
          : null,
      questions: questions.map((q, i) => {
        const picked = picks.get(q._id.toString()) ?? null;
        return {
          _id: q._id,
          number: i + 1,
          kind: q.kind,
          prompt: q.prompt,
          points: q.points,
          options: q.options,
          correctOptionIds: q.correctOptionIds,
          explanation: q.explanation,
          // Null when the viewer did not enter or skipped the question.
          picked,
          earned:
            picked && isCorrect(picked, q.correctOptionIds) ? q.points : 0,
          ...(canManage && {
            answeredCount: q.answeredCount,
            correctCount: q.correctCount,
          }),
        };
      }),
    };
  }

  /** The full board, a page at a time. Final, so plain offsets are safe. */
  async leaderboard(id: string, user: Caller, query: PageQueryDto) {
    const contest = await this.finalized(id, user);
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const offset = query.cursor ? decodeOffset(query.cursor) : 0;
    const rows = await this.board(contest._id)
      .skip(offset)
      .limit(limit + 1)
      .lean()
      .exec();
    return {
      items: rows.slice(0, limit),
      nextCursor:
        rows.length > limit
          ? Buffer.from(String(offset + limit)).toString('base64url')
          : null,
      total: contest.startedCount,
    };
  }
}

function decodeOffset(cursor: string): number {
  const n = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (!Number.isInteger(n) || n < 0) {
    throw new BadRequestException('Invalid cursor');
  }
  return n;
}
