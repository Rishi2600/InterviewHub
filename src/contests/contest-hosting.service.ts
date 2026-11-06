import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { Contest, ContestDocument } from './schemas/contest.schema';
import {
  ContestQuestion,
  ContestQuestionDocument,
} from './schemas/contest-question.schema';
import { HostUsage, HostUsageDocument } from './schemas/host-usage.schema';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { LIMITS } from '../common/validation/limits';
import { isDuplicateKey } from '../common/mongo-errors';
import { PublishCheck, publishChecks } from './publish-checks';
import { UpdateContestDto } from './dto/update-contest.dto';
import { QuestionDto } from './dto/save-questions.dto';

type Caller = Pick<AuthUser, 'userId' | 'role'>;

export interface FreeUsage {
  used: number;
  limit: number;
  resetsAt: Date;
}

export interface EditorView {
  contest: ContestDocument;
  questions: ContestQuestionDocument[];
  checks: PublishCheck[];
  // Null for admins, who have no limit.
  usage: FreeUsage | null;
}

/** 'YYYY-MM' of a date, in UTC: the free limit's month. */
export function usageMonth(at: Date): string {
  return at.toISOString().slice(0, 7);
}

/** The host side of a contest: drafts, the question editor, publishing and
 *  cancelling. */
@Injectable()
export class ContestHostingService {
  constructor(
    @InjectModel(Contest.name)
    private readonly contestModel: Model<ContestDocument>,
    @InjectModel(ContestQuestion.name)
    private readonly questionModel: Model<ContestQuestion>,
    @InjectModel(HostUsage.name)
    private readonly usageModel: Model<HostUsageDocument>,
  ) {}

  createDraft(host: AuthUser, title: string): Promise<ContestDocument> {
    return this.contestModel.create({
      title,
      hostId: new Types.ObjectId(host.userId),
      hostName: host.username,
      status: 'draft',
    });
  }

  /** The contest as its host or an admin may manage it; 404 for anyone else,
   *  so drafts cannot be probed. */
  private async findManaged(
    id: string,
    user: Caller,
  ): Promise<ContestDocument> {
    const contest = Types.ObjectId.isValid(id)
      ? await this.contestModel.findById(id).exec()
      : null;
    const allowed =
      contest &&
      (user.role === 'admin' || contest.hostId.toString() === user.userId);
    if (!allowed) throw new NotFoundException('Contest not found');
    return contest;
  }

  /** Drafts, and published contests before their start, can be edited. */
  private assertEditable(contest: ContestDocument, now: Date): void {
    const upcoming =
      contest.status === 'published' &&
      !!contest.startAt &&
      now < contest.startAt;
    if (contest.status !== 'draft' && !upcoming) {
      throw new ConflictException('This contest can no longer be edited');
    }
  }

  private questionsOf(contestId: Types.ObjectId) {
    return this.questionModel.find({ contestId }).sort({ order: 1 }).exec();
  }

  async editor(
    id: string,
    user: Caller,
    now = new Date(),
  ): Promise<EditorView> {
    const contest = await this.findManaged(id, user);
    const questions = await this.questionsOf(contest._id);
    return {
      contest,
      questions,
      checks: publishChecks(contest, questions, now),
      usage:
        user.role === 'admin' ? null : await this.usage(contest.hostId, now),
    };
  }

  async usage(hostId: Types.ObjectId, now: Date): Promise<FreeUsage> {
    const row = await this.usageModel
      .findOne({ hostId, month: usageMonth(now) })
      .lean()
      .exec();
    const resetsAt = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    return {
      used: row?.published ?? 0,
      limit: LIMITS.contest.freePerMonth,
      resetsAt,
    };
  }

  /** Throws with the failing checks, so the editor can list them. */
  private assertChecksPass(
    contest: Parameters<typeof publishChecks>[0],
    questions: Parameters<typeof publishChecks>[1],
    now: Date,
  ): void {
    const failed = publishChecks(contest, questions, now).filter((c) => !c.ok);
    if (failed.length > 0) {
      throw new BadRequestException(
        failed.map((c) => (c.detail ? `${c.label}: ${c.detail}` : c.label)),
      );
    }
  }

  async updateDetails(
    id: string,
    user: Caller,
    dto: UpdateContestDto,
    now = new Date(),
  ): Promise<ContestDocument> {
    const contest = await this.findManaged(id, user);
    this.assertEditable(contest, now);

    const next = {
      title: dto.title ?? contest.title,
      description: dto.description ?? contest.description,
      startAt: dto.startAt === undefined ? contest.startAt : dto.startAt,
      durationMinutes: dto.durationMinutes ?? contest.durationMinutes,
      capacity: dto.capacity === undefined ? contest.capacity : dto.capacity,
    };
    const endAt =
      next.startAt && next.durationMinutes
        ? new Date(next.startAt.getTime() + next.durationMinutes * 60_000)
        : null;

    if (contest.status === 'published') {
      // A published contest must stay publishable after every edit.
      if (next.capacity !== null && next.capacity < contest.entrantCount) {
        throw new BadRequestException(
          'Capacity cannot be below the number already entered',
        );
      }
      this.assertChecksPass(next, await this.questionsOf(contest._id), now);
    }

    const updated = await this.contestModel
      .findOneAndUpdate(
        { _id: contest._id, status: contest.status },
        { $set: { ...next, endAt } },
        { new: true },
      )
      .exec();
    if (!updated) throw new ConflictException('The contest changed; reload it');
    return updated;
  }

  /**
   * Replaces the question list. Each slot is written in place by its order,
   * then any slots past the new end are removed, so a failure part-way never
   * leaves the contest without questions; saving again repairs it.
   */
  async saveQuestions(
    id: string,
    user: Caller,
    input: QuestionDto[],
    now = new Date(),
  ): Promise<ContestQuestionDocument[]> {
    const contest = await this.findManaged(id, user);
    this.assertEditable(contest, now);

    const questions = input.map((q, order) => {
      const ids = q.options.map((o) => o.id);
      if (new Set(ids).size !== ids.length) {
        throw new BadRequestException(
          `Question ${order + 1} has two options with the same id`,
        );
      }
      return {
        contestId: contest._id,
        order,
        kind: q.kind,
        prompt: q.prompt,
        options: q.options.map((o) => ({ id: o.id, text: o.text })),
        // Drop marks on options that no longer exist.
        correctOptionIds: [...new Set(q.correctOptionIds)].filter((c) =>
          ids.includes(c),
        ),
        points: q.points ?? 1,
        explanation: q.explanation ?? '',
      };
    });
    if (contest.status === 'published') {
      this.assertChecksPass(contest, questions, now);
    }

    if (questions.length > 0) {
      await this.questionModel.bulkWrite(
        questions.map((q) => ({
          replaceOne: {
            filter: { contestId: contest._id, order: q.order },
            replacement: q,
            upsert: true,
          },
        })),
      );
    }
    await this.questionModel
      .deleteMany({ contestId: contest._id, order: { $gte: questions.length } })
      .exec();
    await this.contestModel
      .updateOne(
        { _id: contest._id },
        { $set: { questionCount: questions.length } },
      )
      .exec();
    return this.questionsOf(contest._id);
  }

  /**
   * Publishes a draft. Only its host can, and only once every check passes.
   * Non-admins use one of their free contests for the month: the slot is
   * taken with one conditional increment, so two publishes at once cannot
   * both take the last one.
   */
  async publish(
    id: string,
    user: Caller,
    now = new Date(),
  ): Promise<ContestDocument> {
    const contest = await this.findManaged(id, user);
    if (contest.hostId.toString() !== user.userId) {
      throw new ForbiddenException('Only the host can publish this contest');
    }
    if (contest.status !== 'draft') {
      throw new ConflictException('Only a draft can be published');
    }
    this.assertChecksPass(contest, await this.questionsOf(contest._id), now);

    const month = usageMonth(now);
    const counted = user.role !== 'admin';
    if (counted) await this.takeFreeSlot(contest.hostId, month);

    const published = await this.contestModel
      .findOneAndUpdate(
        { _id: contest._id, status: 'draft' },
        { $set: { status: 'published', publishedAt: now } },
        { new: true },
      )
      .exec();
    if (!published) {
      if (counted) await this.giveSlotBack(contest.hostId, month);
      throw new ConflictException('Only a draft can be published');
    }
    return published;
  }

  private async takeFreeSlot(hostId: Types.ObjectId, month: string) {
    const filter = {
      hostId,
      month,
      published: { $lt: LIMITS.contest.freePerMonth },
    };
    const inc = { $inc: { published: 1 } };
    try {
      // With no row yet, the upsert creates one at 1. With a full row, the
      // filter misses, the upsert tries a second row and the unique index
      // refuses it.
      await this.usageModel.updateOne(filter, inc, { upsert: true }).exec();
      return;
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
    }
    // Refused: either the row is full, or another publish created it a
    // moment ago. Try once more against the existing row.
    const { modifiedCount } = await this.usageModel
      .updateOne(filter, inc)
      .exec();
    if (modifiedCount === 0) {
      throw new ForbiddenException(
        `You have used your ${LIMITS.contest.freePerMonth} free contests this month`,
      );
    }
  }

  private async giveSlotBack(hostId: Types.ObjectId, month: string) {
    await this.usageModel
      .updateOne(
        { hostId, month, published: { $gt: 0 } },
        { $inc: { published: -1 } },
      )
      .exec();
  }

  /**
   * Cancels a published contest: the host before the start, an admin any
   * time before results. Cancelling before anyone joins gives the free slot
   * back. The "nobody joined" test is part of the same atomic update that
   * cancels, so a join cannot slip in between.
   */
  async cancel(
    id: string,
    user: Caller,
    now = new Date(),
  ): Promise<ContestDocument> {
    const contest = await this.findManaged(id, user);
    if (contest.status !== 'published') {
      throw new ConflictException('Only a published contest can be cancelled');
    }
    const base: QueryFilter<Contest> = {
      _id: contest._id,
      status: 'published',
      finalizedAt: null,
      ...(user.role === 'admin' ? {} : { startAt: { $gt: now } }),
    };
    const set = { $set: { status: 'cancelled', cancelledAt: now } };

    const early = await this.contestModel
      .findOneAndUpdate(
        { ...base, entrantCount: 0, startAt: { $gt: now } },
        set,
        { new: true },
      )
      .exec();
    if (early) {
      if (early.publishedAt) {
        await this.giveSlotBack(early.hostId, usageMonth(early.publishedAt));
      }
      return early;
    }
    const late = await this.contestModel
      .findOneAndUpdate(base, set, { new: true })
      .exec();
    if (!late) {
      throw new ConflictException(
        user.role === 'admin'
          ? 'Results are already out'
          : 'This contest has already started, so only an admin can cancel it',
      );
    }
    return late;
  }

  /** Deletes a draft and its questions. Published contests are cancelled
   *  instead, so entrants keep a record. */
  async deleteDraft(id: string, user: Caller): Promise<void> {
    const contest = await this.findManaged(id, user);
    const { deletedCount } = await this.contestModel
      .deleteOne({ _id: contest._id, status: 'draft' })
      .exec();
    if (deletedCount === 0) {
      throw new ConflictException('Only a draft can be deleted');
    }
    await this.questionModel.deleteMany({ contestId: contest._id }).exec();
  }
}
