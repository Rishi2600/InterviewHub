import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ContestDocument, Contest } from './schemas/contest.schema';
import {
  ContestEntry,
  ContestEntryDocument,
} from './schemas/contest-entry.schema';
import { ContestQuestion } from './schemas/contest-question.schema';
import { ContestsService } from './contests.service';
import { phaseOf } from './contest-views';
import { seededShuffle } from './shuffle';
import { isDuplicateKey } from '../common/mongo-errors';
import { AuthUser } from '../common/decorators/current-user.decorator';

type Caller = Pick<AuthUser, 'userId' | 'username' | 'role'>;

/** What the workspace needs: the questions in this entrant's own order,
 *  without the answer key, and the answers saved so far. */
export interface Workspace {
  contest: {
    _id: Types.ObjectId;
    title: string;
    startAt: Date | null;
    endAt: Date | null;
    questionCount: number;
    totalPoints: number;
  };
  // The server's clock, so the timer is right even if the device's is not.
  serverNow: Date;
  entry: {
    joinedAt: Date;
    startedAt: Date | null;
    submittedAt: Date | null;
  };
  questions: {
    _id: Types.ObjectId;
    kind: string;
    prompt: string;
    points: number;
    options: { id: string; text: string }[];
  }[];
  answers: Record<string, string[]>;
}

/** The entrant side of a contest: join, leave, start, answer and submit. */
@Injectable()
export class ContestEntrantService {
  constructor(
    @InjectModel(Contest.name)
    private readonly contestModel: Model<ContestDocument>,
    @InjectModel(ContestEntry.name)
    private readonly entryModel: Model<ContestEntryDocument>,
    @InjectModel(ContestQuestion.name)
    private readonly questionModel: Model<ContestQuestion>,
    private readonly contests: ContestsService,
  ) {}

  /**
   * Joins a published contest before its end. Capacity is checked and the
   * entrant count raised in one atomic update, so a full contest can never
   * take one more. Joining twice returns the existing entry.
   */
  async join(
    id: string,
    user: Caller,
    now = new Date(),
  ): Promise<ContestEntryDocument> {
    const contest = await this.contests.findVisible(id, user);
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
    if (!taken) throw new BadRequestException(whyClosed(contest, now));

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
      await this.changeCount(contest._id, 'entrantCount', -1);
      return this.entryModel
        .findOne({ contestId: contest._id, userId })
        .orFail()
        .exec();
    }
  }

  /** Leaves a contest. Only before the start, so nobody can peek and go. */
  async leave(id: string, user: Caller, now = new Date()): Promise<void> {
    const contest = await this.contests.findVisible(id, user);
    if (phaseOf(contest, now) !== 'upcoming') {
      throw new ConflictException('You can only leave before the start');
    }
    const { deletedCount } = await this.entryModel
      .deleteOne({
        contestId: contest._id,
        userId: new Types.ObjectId(user.userId),
      })
      .exec();
    if (deletedCount === 0) throw new NotFoundException('You have not joined');
    await this.changeCount(contest._id, 'entrantCount', -1);
  }

  /** The caller's entry in a live contest, or why there is none. */
  private async liveEntry(
    id: string,
    user: Caller,
    now: Date,
  ): Promise<{ contest: ContestDocument; entry: ContestEntryDocument }> {
    const contest = await this.contests.findVisible(id, user);
    const phase = phaseOf(contest, now);
    if (phase === 'upcoming') throw new ConflictException('Not started yet');
    if (phase !== 'live') throw new ConflictException('Contest has ended');
    const entry = await this.entryModel
      .findOne({
        contestId: contest._id,
        userId: new Types.ObjectId(user.userId),
      })
      .exec();
    if (!entry) throw new ForbiddenException('Join the contest first');
    return { contest, entry };
  }

  /**
   * Opens the workspace. The first open marks the entrant as started; later
   * opens (a reload, another tab) return the same workspace.
   */
  async start(id: string, user: Caller, now = new Date()): Promise<Workspace> {
    const { contest, entry } = await this.liveEntry(id, user, now);
    if (!entry.startedAt) {
      const marked = await this.entryModel
        .updateOne(
          { _id: entry._id, startedAt: null },
          { $set: { startedAt: now } },
        )
        .exec();
      if (marked.modifiedCount === 1) {
        entry.startedAt = now;
        await this.changeCount(contest._id, 'startedCount', 1);
      }
    }

    const questions = await this.questionModel
      .find({ contestId: contest._id })
      .sort({ order: 1 })
      .lean()
      .exec();
    const seed = entry._id.toString();
    return {
      contest: {
        _id: contest._id,
        title: contest.title,
        startAt: contest.startAt,
        endAt: contest.endAt,
        questionCount: contest.questionCount,
        totalPoints: contest.totalPoints,
      },
      serverNow: now,
      entry: {
        joinedAt: entry.joinedAt,
        startedAt: entry.startedAt,
        submittedAt: entry.submittedAt,
      },
      // Correct answers and explanations stay on the server until the end.
      questions: seededShuffle(questions, seed).map((q) => ({
        _id: q._id,
        kind: q.kind,
        prompt: q.prompt,
        points: q.points,
        options: seededShuffle(q.options, `${seed}:${q._id.toString()}`),
      })),
      answers: Object.fromEntries(
        entry.answers.map((a) => [a.questionId.toString(), a.optionIds]),
      ),
    };
  }

  /**
   * Saves one answer as it is picked; an empty pick clears it. Refused once
   * the entry is submitted or the contest has ended.
   */
  async saveAnswer(
    id: string,
    questionId: string,
    optionIds: string[],
    user: Caller,
    now = new Date(),
  ): Promise<{ questionId: string; optionIds: string[] }> {
    const { contest, entry } = await this.liveEntry(id, user, now);
    if (!entry.startedAt)
      throw new ConflictException('Open the workspace first');
    if (entry.submittedAt) throw new ConflictException('Already submitted');

    const question = Types.ObjectId.isValid(questionId)
      ? await this.questionModel
          .findOne({ _id: questionId, contestId: contest._id })
          .lean()
          .exec()
      : null;
    if (!question) throw new NotFoundException('Question not found');
    const picked = [...new Set(optionIds)];
    const valid = new Set(question.options.map((o) => o.id));
    if (picked.some((o) => !valid.has(o))) {
      throw new BadRequestException('Unknown option');
    }
    if (question.kind === 'single' && picked.length > 1) {
      throw new BadRequestException('Pick one option');
    }

    const qid = question._id;
    const open = { _id: entry._id, submittedAt: null };
    if (picked.length === 0) {
      await this.entryModel
        .updateOne(open, { $pull: { answers: { questionId: qid } } })
        .exec();
    } else {
      // Update the answer in place, or add it if this is the first pick.
      const updated = await this.entryModel
        .updateOne(
          { ...open, 'answers.questionId': qid },
          {
            $set: {
              'answers.$.optionIds': picked,
              'answers.$.answeredAt': now,
            },
          },
        )
        .exec();
      if (updated.matchedCount === 0) {
        await this.entryModel
          .updateOne(
            { ...open, 'answers.questionId': { $ne: qid } },
            {
              $push: {
                answers: {
                  questionId: qid,
                  optionIds: picked,
                  answeredAt: now,
                },
              },
            },
          )
          .exec();
      }
    }
    return { questionId: qid.toString(), optionIds: picked };
  }

  /** Hands the entry in. Answers are final from here. */
  async submit(
    id: string,
    user: Caller,
    now = new Date(),
  ): Promise<{ submittedAt: Date }> {
    const { contest, entry } = await this.liveEntry(id, user, now);
    if (!entry.startedAt)
      throw new ConflictException('Open the workspace first');
    const done = await this.entryModel
      .updateOne(
        { _id: entry._id, submittedAt: null },
        { $set: { submittedAt: now } },
      )
      .exec();
    if (done.modifiedCount === 0)
      throw new ConflictException('Already submitted');
    await this.changeCount(contest._id, 'submittedCount', 1);
    return { submittedAt: now };
  }

  private async changeCount(
    contestId: Types.ObjectId,
    field: 'entrantCount' | 'startedCount' | 'submittedCount',
    by: 1 | -1,
  ): Promise<void> {
    await this.contestModel
      .updateOne({ _id: contestId }, { $inc: { [field]: by } })
      .exec();
  }
}

function whyClosed(contest: ContestDocument, now: Date): string {
  if (contest.status === 'cancelled') return 'Contest was cancelled';
  if (contest.endAt && contest.endAt <= now) return 'Contest has ended';
  return 'Contest is full';
}
