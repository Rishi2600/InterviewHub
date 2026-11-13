import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { utcDay } from '../ai/daily-budget';
import { isDuplicateKey } from '../common/mongo-errors';
import { PREP_LIMITS, PrepMode } from './prep.constants';
import { PrepUsage } from './schemas/prep-usage.schema';

const LIMIT: Record<PrepMode, number> = {
  drill: PREP_LIMITS.drillsPerDay,
  coach: PREP_LIMITS.coachPerDay,
};

/** Each candidate's drills and coach sessions per UTC day. */
@Injectable()
export class PrepUsageService {
  constructor(
    @InjectModel(PrepUsage.name) private readonly model: Model<PrepUsage>,
  ) {}

  /** Takes one of today's slots, in one conditional update. */
  async take(userId: Types.ObjectId, mode: PrepMode, now: Date) {
    const filter = { userId, day: utcDay(now), [mode]: { $lt: LIMIT[mode] } };
    const inc = { $inc: { [mode]: 1 } };
    try {
      await this.model.updateOne(filter, inc, { upsert: true }).exec();
      return;
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
    }
    const { modifiedCount } = await this.model.updateOne(filter, inc).exec();
    if (modifiedCount === 0) {
      throw new ForbiddenException({
        message:
          mode === 'drill'
            ? `You've used today's ${LIMIT.drill} drills`
            : `You've used today's ${LIMIT.coach} coach sessions`,
        error: 'PrepDayUsed',
      });
    }
  }

  async giveBack(userId: Types.ObjectId, mode: PrepMode, day: string) {
    await this.model
      .updateOne({ userId, day, [mode]: { $gt: 0 } }, { $inc: { [mode]: -1 } })
      .exec();
  }

  /** Today's use, for the prep page. */
  async today(userId: Types.ObjectId, now: Date) {
    const row = await this.model
      .findOne({ userId, day: utcDay(now) })
      .lean()
      .exec();
    const next = new Date(now);
    next.setUTCHours(24, 0, 0, 0);
    return {
      drill: { used: row?.drill ?? 0, limit: LIMIT.drill },
      coach: { used: row?.coach ?? 0, limit: LIMIT.coach },
      resetsAt: next,
    };
  }
}
