import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PrepAiClient } from '../ai/ai.types';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { ALL_TOPICS } from '../common/topics';
import { PracticeInterview } from '../practice/schemas/practice-interview.schema';
import { ReviewsService } from '../rooms/reviews/reviews.service';
import { DrillService } from './drill.service';
import { PrepUsageService } from './prep-usage.service';
import { coachListItem, drillListItem } from './prep.views';
import {
  Evidence,
  fromCoach,
  fromDrill,
  fromInterview,
  fromReview,
  strengths,
  STRENGTH,
  suggestions,
  TopicStrength,
} from './strength';
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
    private readonly reviews: ReviewsService,
    private readonly ai: PrepAiClient,
    private readonly usage: PrepUsageService,
    private readonly drill: DrillService,
  ) {}

  async overview(user: AuthUser, now = new Date()) {
    const userId = new Types.ObjectId(user.userId);
    await this.drill.closeIdle(userId, now);
    const [today, running, coaching, profile, history, evidence] =
      await Promise.all([
        this.usage.today(userId, now),
        this.drills.findOne({ userId, active: true }).lean().exec(),
        this.sessions
          .findOne({ userId, purpose: 'coach', status: 'active' })
          .select('topic level endsAt')
          .lean()
          .exec(),
        this.profiles.findOne({ userId }).lean().exec(),
        this.history(user),
        this.evidence(userId, now),
      ]);
    const focus = profile?.focus ?? [];
    const topics = strengths(evidence, now);
    // A suggested session's level when the topic has none of its own.
    const lastLevel =
      [...evidence].sort((a, b) => b.at.getTime() - a.at.getTime())[0]?.level ??
      'junior';
    const withLevel = (t: TopicStrength) => ({
      ...t,
      level: t.level ?? lastLevel,
    });
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
      focus,
      // The tailored part of the page. See docs/PREP_DESIGN.md §5.
      recommended: {
        focus: focus
          .map((f) => topics.find((t) => t.topic === f))
          .filter((t): t is TopicStrength => !!t)
          .map(withLevel),
        suggestions: suggestions(topics, focus).map(withLevel),
        topics,
      },
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

  /** Recent finished practice interviews, coach sessions, drills and reviews. */
  private async evidence(userId: Types.ObjectId, now: Date) {
    const since = new Date(now.getTime() - STRENGTH.windowDays * 86_400_000);
    const [sessions, drills, reviews] = await Promise.all([
      this.sessions
        .find({ userId, status: 'done', endedAt: { $gte: since } })
        .select('purpose topic level startedAt endedAt feedback')
        .lean()
        .exec(),
      this.drills
        .find({ userId, status: 'done', endedAt: { $gte: since } })
        .select('topic level answered right items startedAt endedAt')
        .lean()
        .exec(),
      this.reviews.since(userId, since),
    ]);
    const all: (Evidence | null)[] = [
      ...sessions.map((s) =>
        s.purpose === 'coach' ? fromCoach(s) : fromInterview(s),
      ),
      ...drills.map((d) => fromDrill({ ...d, total: d.items.length })),
      ...reviews.flatMap((r) => fromReview({ ...r, at: r.updatedAt })),
    ];
    return all.filter((e): e is Evidence => e !== null);
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
