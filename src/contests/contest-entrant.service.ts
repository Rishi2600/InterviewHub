import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
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
import {
  CodeSubmission,
  CodeSubmissionDocument,
} from './schemas/code-submission.schema';
import { SubmissionView, toCodeQuestion, toSubmission } from './code-views';
import { CodeDto } from './dto/code.dto';
import { LIMITS } from '../common/validation/limits';
import type { CodeLanguage } from '../judge/sandbox/types';
import { ContestsService } from './contests.service';
import { phaseOf } from './contest-views';
import { seededShuffle } from './shuffle';
import { isDuplicateKey } from '../common/mongo-errors';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { ContestsGateway } from './contests.gateway';

type Caller = Pick<AuthUser, 'userId' | 'username' | 'role'>;

/** What the workspace needs: the questions in this entrant's own order,
 *  without the answer key, and the answers saved so far. */
export interface Workspace {
  contest: {
    _id: Types.ObjectId;
    format: string;
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
  questions: (
    | {
        _id: Types.ObjectId;
        kind: string;
        prompt: string;
        points: number;
        options: { id: string; text: string }[];
      }
    | ReturnType<typeof toCodeQuestion>
  )[];
  answers: Record<string, string[]>;
  // Code contests: the saved draft and the latest submission per question.
  drafts: Record<
    string,
    { language: CodeLanguage; code: string; savedAt: Date }
  >;
  latest: Record<string, SubmissionView>;
}

// Submissions an entrant can make per minute, across a contest's questions.
const SUBMIT_WINDOW_MS = 60_000;

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
    @InjectModel(CodeSubmission.name)
    private readonly submissionModel: Model<CodeSubmissionDocument>,
    private readonly contests: ContestsService,
    private readonly gateway: ContestsGateway,
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
      const entry = await this.entryModel.create({
        contestId: contest._id,
        userId,
        username: user.username,
        joinedAt: now,
      });
      this.gateway.countsChanged(contest._id.toString());
      return entry;
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
    const base = {
      contest: {
        _id: contest._id,
        format: contest.format,
        title: contest.title,
        startAt: contest.startAt,
        endAt: contest.endAt,
        questionCount: contest.questionCount,
        totalPoints: contest.totalPoints,
      },
      // The server's clock, so the timer is right even if the device's is not.
      serverNow: now,
      entry: {
        joinedAt: entry.joinedAt,
        startedAt: entry.startedAt,
        submittedAt: entry.submittedAt,
      },
    };

    if (contest.format === 'code') {
      // Code questions keep the host's order: "problem 2" means the same to
      // everyone.
      return {
        ...base,
        questions: questions.map(toCodeQuestion),
        answers: {},
        drafts: Object.fromEntries(
          entry.drafts.map((d) => [
            d.questionId.toString(),
            { language: d.language, code: d.code, savedAt: d.savedAt },
          ]),
        ),
        latest: await this.latestSubmissions(contest._id, entry.userId),
      };
    }

    const seed = entry._id.toString();
    return {
      ...base,
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
      drafts: {},
      latest: {},
    };
  }

  /** Each question's newest submission by this entrant. */
  private async latestSubmissions(
    contestId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<Record<string, SubmissionView>> {
    const rows = await this.submissionModel
      .aggregate<CodeSubmission & { _id: Types.ObjectId }>([
        { $match: { contestId, userId } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$questionId', doc: { $first: '$$ROOT' } } },
        { $replaceWith: '$doc' },
      ])
      .exec();
    return Object.fromEntries(
      rows.map((s) => [s.questionId.toString(), toSubmission(s)]),
    );
  }

  /** A code question of this contest, or 404. */
  private async codeQuestion(contestId: Types.ObjectId, questionId: string) {
    const question = Types.ObjectId.isValid(questionId)
      ? await this.questionModel
          .findOne({ _id: questionId, contestId, kind: 'code' })
          .lean()
          .exec()
      : null;
    if (!question) throw new NotFoundException('Question not found');
    return question;
  }

  /** Autosaves the code being written for one question. Drafts are never
   *  judged or scored. */
  async saveDraft(
    id: string,
    questionId: string,
    dto: CodeDto,
    user: Caller,
    now = new Date(),
  ): Promise<{ questionId: string; savedAt: Date }> {
    const { contest, entry } = await this.liveEntry(id, user, now);
    if (!entry.startedAt)
      throw new ConflictException('Open the workspace first');
    if (entry.submittedAt) throw new ConflictException('Already finished');
    const question = await this.codeQuestion(contest._id, questionId);

    const qid = question._id;
    const open = { _id: entry._id, submittedAt: null };
    const draft = { language: dto.language, code: dto.code, savedAt: now };
    const updated = await this.entryModel
      .updateOne(
        { ...open, 'drafts.questionId': qid },
        {
          $set: {
            'drafts.$.language': draft.language,
            'drafts.$.code': draft.code,
            'drafts.$.savedAt': now,
          },
        },
      )
      .exec();
    if (updated.matchedCount === 0) {
      await this.entryModel
        .updateOne(
          { ...open, 'drafts.questionId': { $ne: qid } },
          { $push: { drafts: { questionId: qid, ...draft } } },
        )
        .exec();
    }
    return { questionId: qid.toString(), savedAt: now };
  }

  /**
   * Queues a program to be judged against the question's hidden tests. An
   * entrant may have one submission waiting at a time, and make
   * LIMITS.code.submitsPerMinute a minute. The last one judged counts.
   */
  async submitCode(
    id: string,
    questionId: string,
    dto: CodeDto,
    user: Caller,
    now = new Date(),
  ): Promise<SubmissionView> {
    const { contest, entry } = await this.liveEntry(id, user, now);
    if (!entry.startedAt)
      throw new ConflictException('Open the workspace first');
    if (entry.submittedAt) throw new ConflictException('Already finished');
    const question = await this.codeQuestion(contest._id, questionId);

    const recent = await this.submissionModel
      .countDocuments({
        userId: entry.userId,
        createdAt: { $gt: new Date(now.getTime() - SUBMIT_WINDOW_MS) },
      })
      .exec();
    if (recent >= LIMITS.code.submitsPerMinute) {
      throw new HttpException(
        `You can submit ${LIMITS.code.submitsPerMinute} times a minute. Wait a moment and try again.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      const submission = await this.submissionModel.create({
        contestId: contest._id,
        questionId: question._id,
        userId: entry.userId,
        language: dto.language,
        code: dto.code,
      });
      return toSubmission(submission);
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      throw new ConflictException('Your last submission is still being judged');
    }
  }

  /** The caller's own submissions to one question, newest first. Open any
   *  time after joining, so results can link back to them. */
  async listSubmissions(
    id: string,
    questionId: string,
    user: Caller,
  ): Promise<SubmissionView[]> {
    const contest = await this.contests.findVisible(id, user);
    const question = await this.codeQuestion(contest._id, questionId);
    const rows = await this.submissionModel
      .find({
        contestId: contest._id,
        questionId: question._id,
        userId: new Types.ObjectId(user.userId),
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('-code')
      .lean()
      .exec();
    return rows.map(toSubmission);
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
    this.gateway.countsChanged(contestId.toString());
  }
}

function whyClosed(contest: ContestDocument, now: Date): string {
  if (contest.status === 'cancelled') return 'Contest was cancelled';
  if (contest.endAt && contest.endAt <= now) return 'Contest has ended';
  return 'Contest is full';
}
