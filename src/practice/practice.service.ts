import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomInt } from 'crypto';
import { Model, Types } from 'mongoose';
import { AiClient } from '../ai/ai.types';
import { ActivityEvent } from '../activity/schemas/activity-event.schema';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { isDuplicateKey } from '../common/mongo-errors';
import { usageMonth } from '../contests/contest-hosting.service';
import { AiBudgetService } from './ai-budget.service';
import { StartPracticeDto } from './dto/start-practice.dto';
import { PracticeFeedbackService } from './practice-feedback.service';
import { PracticeNotifier } from './practice.notifier';
import {
  MIXED,
  PRACTICE_LIMITS,
  PracticeKind,
  TOPICS,
} from './practice.constants';
import { interviewView, listItemView } from './practice.views';
import {
  EndReason,
  PracticeInterview,
} from './schemas/practice-interview.schema';
import { PracticeUsage } from './schemas/practice-usage.schema';

// Answers still on their way when time runs out get this long.
const GRACE_MS = 30_000;
// Feedback the every-minute job writes at most per run, one at a time to
// stay under the per-minute token limit.
const FEEDBACK_PER_RUN = 3;

/**
 * Practice interviews with the AI interviewer: starting one within the
 * monthly and daily limits, the history, ending and deleting. The
 * conversation itself is in PracticeConversationService.
 */
@Injectable()
export class PracticeService {
  private readonly logger = new Logger(PracticeService.name);

  constructor(
    @InjectModel(PracticeInterview.name)
    private readonly model: Model<PracticeInterview>,
    @InjectModel(PracticeUsage.name)
    private readonly usageModel: Model<PracticeUsage>,
    @InjectModel(ActivityEvent.name)
    private readonly eventModel: Model<ActivityEvent>,
    private readonly ai: AiClient,
    private readonly budget: AiBudgetService,
    private readonly feedback: PracticeFeedbackService,
    private readonly notifier: PracticeNotifier,
  ) {}

  async start(user: AuthUser, dto: StartPracticeDto, now = new Date()) {
    if (!this.ai.enabled) {
      throw new ServiceUnavailableException({
        message: "AI practice isn't set up on this server",
        error: 'PracticeOff',
      });
    }
    const topics = TOPICS[dto.kind];
    if (dto.topic !== MIXED && !topics.includes(dto.topic)) {
      throw new BadRequestException(
        `Unknown topic for a ${dto.kind} interview`,
      );
    }
    const userId = new Types.ObjectId(user.userId);
    if (await this.model.exists({ userId, running: true })) throw running();

    const month = usageMonth(now);
    await this.takeSlot(userId, month);
    const reservation = await this.budget.reserve(now);
    if (typeof reservation === 'string') {
      await this.giveSlotBack(userId, month);
      throw new ServiceUnavailableException(
        reservation === 'busy'
          ? {
              message:
                'AI interviews are full right now. Try again in a few minutes.',
              error: 'PracticeBusy',
            }
          : {
              message:
                'AI interviews are used up for today. Try again tomorrow.',
              error: 'PracticeDayFull',
            },
      );
    }

    const recent = await this.recent(userId, dto.kind);
    const mixed = dto.topic === MIXED;
    try {
      const iv = await this.model.create({
        userId,
        kind: dto.kind,
        topic: mixed ? pickTopic(topics, recent.topics) : dto.topic,
        mixed,
        level: dto.level,
        minutes: dto.minutes,
        language: dto.kind === 'technical' ? (dto.language ?? null) : null,
        mode: dto.mode ?? 'chat',
        running: true,
        startedAt: now,
        endsAt: new Date(now.getTime() + dto.minutes * 60_000),
        quota: reservation,
        avoid: recent.questions,
      });
      return interviewView(iv.toObject());
    } catch (err) {
      await this.giveSlotBack(userId, month);
      await this.budget.stopped(reservation);
      await this.budget.settle(reservation, { requests: 0, tokens: 0 });
      if (isDuplicateKey(err)) throw running();
      throw err;
    }
  }

  /** The practice page: the allowance, a running interview, the history. */
  async overview(user: AuthUser, now = new Date()) {
    const userId = new Types.ObjectId(user.userId);
    const [usage, rows] = await Promise.all([
      this.usageModel
        .findOne({ userId, month: usageMonth(now) })
        .lean()
        .exec(),
      this.model
        .find({ userId, status: { $ne: 'cancelled' } })
        .select('-turns -feedback -avoid -codingQuestion')
        .sort({ startedAt: -1 })
        .limit(100)
        .lean()
        .exec(),
    ]);
    const live = rows.find((r) => r.status === 'active');
    return {
      enabled: this.ai.enabled,
      allowance: {
        used: usage?.started ?? 0,
        limit: PRACTICE_LIMITS.perMonth,
        resetsAt: new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
        ),
      },
      running: live
        ? {
            id: live._id.toString(),
            kind: live.kind,
            topic: live.topic,
            level: live.level,
            endsAt: live.endsAt,
          }
        : null,
      items: rows.filter((r) => r.status !== 'active').map(listItemView),
    };
  }

  /** The candidate's own interview; anyone else gets a 404. */
  async owned(id: string, user: AuthUser) {
    const iv = Types.ObjectId.isValid(id)
      ? await this.model
          .findOne({ _id: id, userId: new Types.ObjectId(user.userId) })
          .lean()
          .exec()
      : null;
    if (!iv) throw new NotFoundException('Interview not found');
    return iv;
  }

  async get(id: string, user: AuthUser) {
    return interviewView(await this.owned(id, user));
  }

  /** The candidate ends their interview, or it ends because time is up. */
  async endByCandidate(id: string, user: AuthUser, now = new Date()) {
    const iv = await this.owned(id, user);
    if (iv.status !== 'active') return interviewView(iv);
    const reason = now >= iv.endsAt ? 'time' : 'candidate';
    const ended = await this.end(iv._id, reason, now);
    return interviewView(ended ?? (await this.owned(id, user)));
  }

  /**
   * Ends a running interview; only the first call does anything. With no
   * answers it is cancelled and the month's slot given back. Otherwise it
   * adds a square to the activity graph and its feedback is written.
   */
  async end(id: Types.ObjectId | string, reason: EndReason, now = new Date()) {
    const _id = new Types.ObjectId(id);
    const set = { endedAt: now, endReason: reason, busyUntil: null };
    const cancelled = await this.model
      .findOneAndUpdate(
        { _id, status: 'active', answers: 0 },
        {
          $set: { ...set, status: 'cancelled', turns: [] },
          $unset: { running: 1 },
        },
        { new: true },
      )
      .lean()
      .exec();
    const iv =
      cancelled ??
      (await this.model
        .findOneAndUpdate(
          { _id, status: 'active', answers: { $gt: 0 } },
          { $set: { ...set, status: 'ended' }, $unset: { running: 1 } },
          { new: true },
        )
        .lean()
        .exec());
    if (!iv) return null;

    await this.budget.stopped(iv.quota);
    if (iv.status === 'cancelled') {
      await this.giveSlotBack(iv.userId, usageMonth(iv.startedAt));
      await this.budget.settle(iv.quota, {
        requests: iv.usedRequests,
        tokens: iv.usedTokens,
      });
    } else {
      await this.eventModel
        .updateOne(
          { kind: 'dummy', refId: iv._id, userId: iv.userId },
          { $set: { at: now, data: { kind: iv.kind, topic: iv.topic } } },
          { upsert: true },
        )
        .exec();
      this.feedback.write(iv._id, now).catch((err: Error) => {
        this.logger.error(`Feedback for ${iv._id.toString()}: ${err.message}`);
      });
    }
    this.notifier.emit(iv._id.toString(), 'practice:ended', {
      id: iv._id.toString(),
      status: iv.status,
      reason,
    });
    return iv;
  }

  /** Deletes the feedback. The activity square stays: it happened. */
  async remove(id: string, user: AuthUser) {
    const iv = await this.owned(id, user);
    if (iv.status === 'active') {
      throw new ConflictException('End the interview before deleting it');
    }
    const { deletedCount } = await this.model
      .deleteOne({ _id: iv._id, status: { $ne: 'active' } })
      .exec();
    if (deletedCount && iv.status === 'ended') {
      await this.budget.settle(iv.quota, {
        requests: iv.usedRequests,
        tokens: iv.usedTokens,
      });
    }
  }

  /** Every minute: end overdue interviews, then write due feedback. */
  async sweep(now: Date): Promise<void> {
    const overdue = await this.model
      .find({
        status: 'active',
        endsAt: { $lt: new Date(now.getTime() - GRACE_MS) },
      })
      .select('_id')
      .limit(50)
      .lean()
      .exec();
    for (const { _id } of overdue) await this.end(_id, 'time', now);
    await this.feedback.giveUp(now);
    for (const id of await this.feedback.due(now, FEEDBACK_PER_RUN)) {
      await this.feedback.write(id, now);
    }
  }

  /** Topics and questions from recent interviews, for variety. */
  private async recent(userId: Types.ObjectId, kind: PracticeKind) {
    const rows = await this.model
      .find({ userId, kind, status: 'done' })
      .select('topic feedback.questions.title')
      .sort({ startedAt: -1 })
      .limit(3)
      .lean()
      .exec();
    return {
      topics: rows.map((r) => r.topic),
      questions: rows
        .flatMap((r) => r.feedback?.questions.map((q) => q.title) ?? [])
        .slice(0, 12),
    };
  }

  /** One of the month's free interviews, taken in one conditional update. */
  private async takeSlot(userId: Types.ObjectId, month: string) {
    const filter = {
      userId,
      month,
      started: { $lt: PRACTICE_LIMITS.perMonth },
    };
    const inc = { $inc: { started: 1 } };
    try {
      await this.usageModel.updateOne(filter, inc, { upsert: true }).exec();
      return;
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
    }
    const { modifiedCount } = await this.usageModel
      .updateOne(filter, inc)
      .exec();
    if (modifiedCount === 0) {
      throw new ForbiddenException({
        message: `You've used your ${PRACTICE_LIMITS.perMonth} practice interviews this month`,
        error: 'PracticeMonthUsed',
      });
    }
  }

  private async giveSlotBack(userId: Types.ObjectId, month: string) {
    await this.usageModel
      .updateOne(
        { userId, month, started: { $gt: 0 } },
        { $inc: { started: -1 } },
      )
      .exec();
  }
}

const running = () =>
  new ConflictException({
    message: 'You already have an interview running',
    error: 'PracticeRunning',
  });

/** A random topic, avoiding the recent ones when there are others. */
function pickTopic(topics: readonly string[], recent: string[]): string {
  const fresh = topics.filter((t) => !recent.includes(t));
  const from = fresh.length ? fresh : topics;
  return from[randomInt(from.length)];
}
