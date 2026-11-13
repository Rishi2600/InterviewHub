import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PrepAiClient } from '../ai/ai.types';
import { utcDay } from '../ai/daily-budget';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { isDuplicateKey } from '../common/mongo-errors';
import { skillAreas, topicKind } from '../common/topics';
import { COACH_LIMITS } from '../practice/practice.constants';
import { interviewView } from '../practice/practice.views';
import { PracticeInterview } from '../practice/schemas/practice-interview.schema';
import { StartCoachDto } from './dto/start-coach.dto';
import { PrepBudgetService } from './prep-budget.service';
import { PrepUsageService } from './prep-usage.service';

/**
 * Starts coach sessions. A session runs on the practice engine (same
 * conversation, socket and screen) with `purpose: 'coach'`, on prep's AI
 * client and budget. See docs/PREP_DESIGN.md §3.
 */
@Injectable()
export class CoachService {
  constructor(
    @InjectModel(PracticeInterview.name)
    private readonly sessions: Model<PracticeInterview>,
    private readonly ai: PrepAiClient,
    private readonly budget: PrepBudgetService,
    private readonly usage: PrepUsageService,
  ) {}

  async start(user: AuthUser, dto: StartCoachDto, now = new Date()) {
    if (!this.ai.enabled) {
      throw new ServiceUnavailableException({
        message: "The coach isn't set up on this server",
        error: 'PrepCoachOff',
      });
    }
    // A listed topic has its own type; the candidate's own one says.
    const topic = dto.topic;
    const kind = topicKind(topic) ?? dto.kind ?? 'technical';
    const language = kind === 'technical' ? (dto.language ?? null) : null;
    if (dto.focus && !skillAreas(kind, !!language).includes(dto.focus)) {
      throw new BadRequestException('Unknown focus area for this topic');
    }
    const userId = new Types.ObjectId(user.userId);
    if (await this.sessions.exists({ userId, running: true })) {
      throw running();
    }

    await this.usage.take(userId, 'coach', now);
    const reservation = await this.budget.reserveCoach(now);
    if (typeof reservation === 'string') {
      await this.usage.giveBack(userId, 'coach', utcDay(now));
      throw new ServiceUnavailableException(
        reservation === 'busy'
          ? {
              message:
                'Coach sessions are full right now. Try again in a few minutes.',
              error: 'PrepCoachBusy',
            }
          : {
              message:
                'Coach sessions are used up for today. Drills still work.',
              error: 'PrepCoachDayFull',
            },
      );
    }
    try {
      const session = await this.sessions.create({
        userId,
        purpose: 'coach',
        focus: dto.focus ?? null,
        kind,
        topic,
        mixed: false,
        level: dto.level,
        minutes: COACH_LIMITS.minutes,
        language,
        mode: dto.mode ?? 'chat',
        running: true,
        startedAt: now,
        endsAt: new Date(now.getTime() + COACH_LIMITS.minutes * 60_000),
        quota: reservation,
        avoid: [],
      });
      return interviewView(session.toObject());
    } catch (err) {
      await this.usage.giveBack(userId, 'coach', utcDay(now));
      await this.budget.stopped(reservation);
      await this.budget.settle(reservation, { requests: 0, tokens: 0 });
      if (isDuplicateKey(err)) throw running();
      throw err;
    }
  }
}

const running = () =>
  new ConflictException({
    message: 'You already have a session running',
    error: 'PrepRunning',
  });
