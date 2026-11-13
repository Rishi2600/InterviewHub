import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PrepAiClient } from '../ai/ai.types';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { ALL_TOPICS } from '../common/topics';
import { PracticeInterview } from '../practice/schemas/practice-interview.schema';
import { DrillService } from './drill.service';
import { PrepUsageService } from './prep-usage.service';
import { coachListItem, drillListItem } from './prep.views';
import { PrepDrill } from './schemas/prep-drill.schema';
import { PrepProfile } from './schemas/prep-profile.schema';

const PAGE = 20;

/** The prep page: today's allowance, what's running, focus and history. */
@Injectable()
export class PrepService {
  constructor(
    @InjectModel(PrepDrill.name) private readonly drills: Model<PrepDrill>,
    @InjectModel(PrepProfile.name)
    private readonly profiles: Model<PrepProfile>,
    @InjectModel(PracticeInterview.name)
    private readonly sessions: Model<PracticeInterview>,
    private readonly ai: PrepAiClient,
    private readonly usage: PrepUsageService,
    private readonly drill: DrillService,
  ) {}

  async overview(user: AuthUser, now = new Date()) {
    const userId = new Types.ObjectId(user.userId);
    await this.drill.closeIdle(userId, now);
    const [today, running, coaching, profile, history] = await Promise.all([
      this.usage.today(userId, now),
      this.drills.findOne({ userId, active: true }).lean().exec(),
      this.sessions
        .findOne({ userId, purpose: 'coach', status: 'active' })
        .select('topic level endsAt')
        .lean()
        .exec(),
      this.profiles.findOne({ userId }).lean().exec(),
      this.history(user),
    ]);
    return {
      // Drills already in the bank work without the AI; coaching needs it.
      aiEnabled: this.ai.enabled,
      today,
      running: {
        drill: running ? drillListItem(running) : null,
        coach: coaching
          ? {
              id: coaching._id.toString(),
              topic: coaching.topic,
              level: coaching.level,
              endsAt: coaching.endsAt,
            }
          : null,
      },
      focus: profile?.focus ?? [],
      ...history,
    };
  }

  /** Finished and running sessions, newest first, `before` a date. */
  async history(user: AuthUser, before?: string) {
    const userId = new Types.ObjectId(user.userId);
    const until = before ? new Date(before) : null;
    if (until && Number.isNaN(until.getTime())) {
      throw new BadRequestException('Bad date');
    }
    const when = until ? { startedAt: { $lt: until } } : {};
    const [drills, coaching] = await Promise.all([
      this.drills
        .find({ userId, ...when })
        .sort({ startedAt: -1 })
        .limit(PAGE + 1)
        .lean()
        .exec(),
      this.sessions
        .find({
          userId,
          purpose: 'coach',
          status: { $ne: 'cancelled' },
          ...when,
        })
        .select('-turns -avoid -codingQuestion -feedback')
        .sort({ startedAt: -1 })
        .limit(PAGE + 1)
        .lean()
        .exec(),
    ]);
    // Both lists newest first; merged, then cut to a page.
    const all = [
      ...drills.map(drillListItem),
      ...coaching.map(coachListItem),
    ].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    const items = all.slice(0, PAGE);
    return {
      items,
      nextBefore:
        all.length > PAGE
          ? items[items.length - 1].startedAt.toISOString()
          : null,
    };
  }

  /** The candidate's own focus topics, up to 3, from the shared list. */
  async setFocus(user: AuthUser, topics: string[]) {
    const unique = [...new Set(topics)];
    const unknown = unique.find((t) => !ALL_TOPICS.includes(t));
    if (unknown) throw new BadRequestException(`Unknown topic: ${unknown}`);
    const userId = new Types.ObjectId(user.userId);
    await this.profiles
      .updateOne({ userId }, { $set: { focus: unique } }, { upsert: true })
      .exec();
    return { focus: unique };
  }
}
