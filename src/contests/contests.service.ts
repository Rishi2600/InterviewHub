import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Contest, ContestDocument, ContestState } from './schemas/contest.schema';
import {
  ContestEntry,
  ContestEntryDocument,
} from './schemas/contest-entry.schema';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { LeaderboardGateway } from '../leaderboard/leaderboard.gateway';

@Injectable()
export class ContestsService {
  constructor(
    @InjectModel(Contest.name)
    private readonly contestModel: Model<ContestDocument>,
    @InjectModel(ContestEntry.name)
    private readonly entryModel: Model<ContestEntryDocument>,
    private readonly leaderboardService: LeaderboardService,
    private readonly leaderboardGateway: LeaderboardGateway,
  ) {}

  create(ownerId: string, title: string): Promise<ContestDocument> {
    return this.contestModel.create({
      title,
      ownerId: new Types.ObjectId(ownerId),
      state: 'draft',
    });
  }

  async findById(id: string): Promise<ContestDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Contest not found');
    const contest = await this.contestModel.findById(id).exec();
    if (!contest) throw new NotFoundException('Contest not found');
    return contest;
  }

  private assertOwner(contest: ContestDocument, userId: string, role: string): void {
    if (role === 'admin') return;
    if (contest.ownerId.toString() !== userId) {
      throw new ForbiddenException('You do not own this contest');
    }
  }

  async setState(
    id: string,
    userId: string,
    role: string,
    state: ContestState,
  ): Promise<ContestDocument> {
    const contest = await this.findById(id);
    this.assertOwner(contest, userId, role);

    const allowed: Record<ContestState, ContestState[]> = {
      draft: ['active'],
      active: ['ended'],
      ended: [],
    };
    if (contest.state !== state && !allowed[contest.state].includes(state)) {
      throw new BadRequestException(
        `Invalid contest transition: ${contest.state} -> ${state}`,
      );
    }
    contest.state = state;
    if (state === 'ended') contest.endedAt = new Date();
    return contest.save();
  }

  async join(
    id: string,
    user: { userId: string; username: string },
  ): Promise<ContestEntryDocument> {
    const contest = await this.findById(id);
    if (contest.state === 'ended') {
      throw new BadRequestException('Contest has ended');
    }
    const existing = await this.entryModel
      .findOne({
        contestId: contest._id,
        userId: new Types.ObjectId(user.userId),
      })
      .exec();
    if (existing) return existing;

    // Seed the leaderboard at zero so joiners appear immediately.
    await this.leaderboardService.addScore(id, user.userId, 0);
    await this.leaderboardGateway.broadcast(id);

    return this.entryModel.create({
      contestId: contest._id,
      userId: new Types.ObjectId(user.userId),
      username: user.username,
      finalScore: 0,
      finalRank: 0,
    });
  }

  async score(
    id: string,
    ownerId: string,
    role: string,
    targetUserId: string,
    delta: number,
  ): Promise<{ userId: string; score: number }> {
    const contest = await this.findById(id);
    this.assertOwner(contest, ownerId, role);
    if (contest.state !== 'active') {
      throw new BadRequestException('Contest is not active');
    }

    const score = await this.leaderboardService.addScore(id, targetUserId, delta);
    await this.leaderboardGateway.broadcast(id);
    return { userId: targetUserId, score };
  }

  /**
   * Ends the contest and flushes the (Redis or in-memory) leaderboard into
   * Mongo in a single bulkWrite, then clears the live leaderboard.
   */
  async end(id: string, userId: string, role: string): Promise<ContestDocument> {
    const contest = await this.setState(id, userId, role, 'ended');

    const finalBoard = await this.leaderboardService.getAll(id);
    if (finalBoard.length > 0) {
      await this.entryModel.bulkWrite(
        finalBoard.map((entry) => ({
          updateOne: {
            filter: {
              contestId: contest._id,
              userId: new Types.ObjectId(entry.userId),
            },
            update: {
              $set: { finalScore: entry.score, finalRank: entry.rank },
            },
            upsert: false,
          },
        })),
      );
    }

    await this.leaderboardService.clear(id);
    await this.leaderboardGateway.broadcast(id);
    return contest;
  }

  results(id: string): Promise<ContestEntryDocument[]> {
    return this.entryModel
      .find({ contestId: new Types.ObjectId(id) })
      .sort({ finalScore: -1 })
      .exec();
  }
}
