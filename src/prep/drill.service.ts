import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { utcDay } from '../ai/daily-budget';
import { ActivityEvent } from '../activity/schemas/activity-event.schema';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { isDuplicateKey } from '../common/mongo-errors';
import { topicKind } from '../common/topics';
import { AnswerDrillDto } from './dto/answer-drill.dto';
import { StartDrillDto } from './dto/start-drill.dto';
import { PREP_LIMITS } from './prep.constants';
import { PrepUsageService } from './prep-usage.service';
import { drillView } from './prep.views';
import { QuestionWriter } from './question-writer.service';
import { PrepDrill } from './schemas/prep-drill.schema';
import { PrepQuestion } from './schemas/prep-question.schema';

type StoredDrill = PrepDrill & { _id: Types.ObjectId };

/**
 * Drills: 10 bank questions the candidate hasn't seen, answered in order and
 * checked at once, with no AI per answer. A short shelf gets a new batch
 * written first. See docs/PREP_QUESTION_BANK.md.
 */
@Injectable()
export class DrillService {
  constructor(
    @InjectModel(PrepDrill.name) private readonly model: Model<PrepDrill>,
    @InjectModel(PrepQuestion.name)
    private readonly questions: Model<PrepQuestion>,
    @InjectModel(ActivityEvent.name)
    private readonly events: Model<ActivityEvent>,
    private readonly usage: PrepUsageService,
    private readonly writer: QuestionWriter,
  ) {}

  /**
   * Starts a drill, or resumes the running one if it's on the same topic
   * and level. A running drill on something else is finished first.
   */
  async start(user: AuthUser, dto: StartDrillDto, now = new Date()) {
    if (topicKind(dto.topic) !== 'technical') {
      throw new BadRequestException('Drills are for technical topics');
    }
    const userId = new Types.ObjectId(user.userId);
    await this.closeIdle(userId, now);
    const running = await this.model
      .findOne({ userId, active: true })
      .lean()
      .exec();
    if (running?.topic === dto.topic && running.level === dto.level) {
      return this.view(running);
    }
    if (running) await this.finish(running._id, now);

    await this.usage.take(userId, 'drill', now);
    let picked = await this.pick(userId, dto);
    if (picked.length < PREP_LIMITS.drillSize) {
      await this.writer.write(dto.topic, dto.level, now);
      picked = await this.pick(userId, dto);
    }
    if (!picked.length) {
      await this.usage.giveBack(userId, 'drill', utcDay(now));
      throw new ServiceUnavailableException({
        message: `No new ${dto.topic} questions right now. Try again later.`,
        error: 'PrepNoQuestions',
      });
    }
    try {
      const drill = await this.model.create({
        userId,
        topic: dto.topic,
        level: dto.level,
        items: picked.map((questionId) => ({ questionId })),
        active: true,
        startedAt: now,
        lastAt: now,
      });
      return this.view(drill.toObject());
    } catch (err) {
      await this.usage.giveBack(userId, 'drill', utcDay(now));
      if (isDuplicateKey(err)) {
        throw new ConflictException('A drill was started a moment ago');
      }
      throw err;
    }
  }

  async get(id: string, user: AuthUser, now = new Date()) {
    const drill = await this.owned(id, user);
    if (drill.status === 'active' && idle(drill, now)) {
      const done = await this.finish(drill._id, now);
      if (!done) throw new NotFoundException('Drill not found');
      return this.view(done);
    }
    return this.view(drill);
  }

  /** Answers the current question; returns the verdict and the drill. */
  async answer(
    id: string,
    user: AuthUser,
    dto: AnswerDrillDto,
    now = new Date(),
  ) {
    const drill = await this.owned(id, user);
    if (drill.status !== 'active') {
      throw new ConflictException('This drill has finished');
    }
    const i = drill.answered;
    const item = drill.items[i];
    if (!item || item.questionId.toString() !== dto.questionId) {
      throw new ConflictException('Answer the current question');
    }
    const q = await this.questions.findById(item.questionId).lean().exec();
    if (!q) throw new NotFoundException('Question not found');
    const correct = dto.optionId === q.correct;
    const updated = await this.model
      .findOneAndUpdate(
        { _id: drill._id, status: 'active', answered: i },
        {
          $set: {
            [`items.${i}.chosen`]: dto.optionId,
            [`items.${i}.correct`]: correct,
            lastAt: now,
          },
          $inc: { answered: 1, right: correct ? 1 : 0 },
        },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();
    // Already answered (a double click): show the drill as it is.
    if (!updated) return this.get(id, user, now);
    await this.questions
      .updateOne(
        { _id: q._id },
        {
          $inc: {
            answered: 1,
            right: correct ? 1 : 0,
            [`picks.${dto.optionId}`]: 1,
          },
        },
      )
      .exec();
    const done =
      updated.answered >= updated.items.length
        ? await this.finish(updated._id, now)
        : null;
    return this.view(done ?? updated);
  }

  /** Ends the drill now, with what was answered. */
  async end(id: string, user: AuthUser, now = new Date()) {
    const drill = await this.owned(id, user);
    if (drill.status !== 'active') return this.view(drill);
    const done = await this.finish(drill._id, now);
    if (!done) return { id, removed: true };
    return this.view(done);
  }

  /**
   * "This answer looks wrong", on a question the candidate answered in this
   * drill. Flagged by enough different candidates, it's hidden for everyone.
   */
  async flag(id: string, questionId: string, user: AuthUser) {
    const drill = await this.owned(id, user);
    const i = drill.items.findIndex(
      (it) => it.questionId.toString() === questionId && it.chosen !== null,
    );
    if (i < 0) throw new NotFoundException('Answer the question first');
    const userId = new Types.ObjectId(user.userId);
    const qid = drill.items[i].questionId;
    await this.model
      .updateOne({ _id: drill._id }, { $set: { [`items.${i}.flagged`]: true } })
      .exec();
    await this.questions
      .updateOne({ _id: qid }, { $addToSet: { flaggedBy: userId } })
      .exec();
    await this.questions
      .updateOne(
        {
          _id: qid,
          [`flaggedBy.${PREP_LIMITS.flagsToHide - 1}`]: { $exists: true },
        },
        { $set: { hidden: true } },
      )
      .exec();
    return this.get(id, user);
  }

  /** Drills left alone too long are finished with what was answered. */
  async closeIdle(userId: Types.ObjectId, now: Date) {
    const stale = await this.model
      .find({
        userId,
        active: true,
        lastAt: { $lt: new Date(now.getTime() - PREP_LIMITS.drillIdleMs) },
      })
      .select('_id')
      .lean()
      .exec();
    for (const { _id } of stale) await this.finish(_id, now);
  }

  /**
   * Finishes a drill; only the first call does anything. One with answers
   * adds a square to the activity graph; one with none is deleted and its
   * slot given back. Returns the finished drill, or null if deleted.
   */
  private async finish(id: Types.ObjectId, now: Date) {
    const empty = await this.model
      .findOneAndDelete({ _id: id, status: 'active', answered: 0 })
      .lean()
      .exec();
    if (empty) {
      await this.usage.giveBack(empty.userId, 'drill', utcDay(empty.startedAt));
      return null;
    }
    const done = await this.model
      .findOneAndUpdate(
        { _id: id, status: 'active' },
        { $set: { status: 'done', endedAt: now }, $unset: { active: 1 } },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();
    if (!done) return this.model.findById(id).lean().exec();
    await this.events
      .updateOne(
        { kind: 'prep', refId: done._id, userId: done.userId },
        {
          $set: {
            at: now,
            data: {
              mode: 'drill',
              topic: done.topic,
              level: done.level,
              right: done.right,
              answered: done.answered,
            },
          },
        },
        { upsert: true },
      )
      .exec();
    return done;
  }

  /** Up to a drill's worth of shelf questions this candidate hasn't seen. */
  private async pick(userId: Types.ObjectId, dto: StartDrillDto) {
    const seen = await this.model
      .distinct('items.questionId', {
        userId,
        topic: dto.topic,
        level: dto.level,
      })
      .exec();
    const rows = await this.questions
      .aggregate<{ _id: Types.ObjectId }>([
        {
          $match: {
            topic: dto.topic,
            level: dto.level,
            hidden: false,
            _id: { $nin: seen },
          },
        },
        { $sample: { size: PREP_LIMITS.drillSize } },
        { $project: { _id: 1 } },
      ])
      .exec();
    return rows.map((r) => r._id);
  }

  /** The candidate's own drill; anyone else gets a 404. */
  private async owned(id: string, user: AuthUser): Promise<StoredDrill> {
    const drill = Types.ObjectId.isValid(id)
      ? await this.model
          .findOne({ _id: id, userId: new Types.ObjectId(user.userId) })
          .lean()
          .exec()
      : null;
    if (!drill) throw new NotFoundException('Drill not found');
    return drill;
  }

  private async view(drill: StoredDrill) {
    const ids = drill.items.map((i) => i.questionId);
    const rows = await this.questions
      .find({ _id: { $in: ids } })
      .lean()
      .exec();
    return drillView(drill, new Map(rows.map((q) => [q._id.toString(), q])));
  }
}

const idle = (drill: StoredDrill, now: Date) =>
  drill.lastAt.getTime() < now.getTime() - PREP_LIMITS.drillIdleMs;
