import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Contest, ContestDocument } from './schemas/contest.schema';
import { ContestEntry, ContestEntryDocument } from './schemas/contest-entry.schema';
import { CreateContestDto } from './dto/create-contest.dto';
import { AwardScoreDto } from './dto/award-score.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { LeaderboardGateway } from '../leaderboard/leaderboard/leaderboard.gateway';

@Injectable()
export class ContestsService {
  constructor(
    @InjectModel(Contest.name) private contestModel: Model<ContestDocument>,
    @InjectModel(ContestEntry.name) private entryModel: Model<ContestEntryDocument>,
    private leaderboardService: LeaderboardService,
    private leaderboardGateway: LeaderboardGateway,
  ) {}

  async create(dto: CreateContestDto, creator: UserDocument): Promise<ContestDocument> {
    if (creator.role !== 'interviewer') {
      throw new ForbiddenException('Only interviewers can create contests');
    }

    const contest = new this.contestModel({
      title: dto.title,
      description: dto.description ?? '',
      createdBy: creator._id,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
    });

    return contest.save();
  }

  async findById(id: string): Promise<ContestDocument> {
    const contest = await this.contestModel.findById(id).exec();
    if (!contest) throw new NotFoundException('Contest not found');
    return contest;
  }

  async findAll(): Promise<ContestDocument[]> {
    return this.contestModel
      .find({ status: { $ne: 'ended' } })
      .sort({ startAt: 1 })
      .exec();
  }

  // Registers a candidate for a contest
  // Creates a ContestEntry in MongoDB (score starts at 0)
  // and registers them in the Redis leaderboard
  async joinContest(
    contestId: string,
    roomId: string,
    user: UserDocument,
  ): Promise<ContestEntryDocument> {
    const contest = await this.findById(contestId);

    if (contest.status === 'ended') {
      throw new ForbiddenException('This contest has ended');
    }

    // upsert: true — creates if not exists, updates if already joined
    // This handles reconnections gracefully
    const entry = await this.entryModel.findOneAndUpdate(
      {
        contestId: new Types.ObjectId(contestId),
        userId: user._id,
      },
      {
        $setOnInsert: {
          contestId: new Types.ObjectId(contestId),
          userId: user._id,
          username: user.username,
          roomId: new Types.ObjectId(roomId),
          score: 0,
          rank: null,
        },
      },
      { upsert: true, new: true },
    );

    // Register in Redis leaderboard with 0 initial score
    await this.leaderboardService.addScore(
      contestId,
      user._id.toString(),
      user.username,
      0,
    );

    return entry;
  }

  // Awards points to a participant
  // Flow: update Redis → broadcast via WebSocket → the MongoDB entry
  // is only updated with final scores when the contest ends
  // This keeps real-time updates fast — Redis ops are sub-millisecond
  async awardScore(
    contestId: string,
    dto: AwardScoreDto,
    awarder: UserDocument,
  ): Promise<{ newScore: number }> {
    if (awarder.role !== 'interviewer') {
      throw new ForbiddenException('Only interviewers can award scores');
    }

    const contest = await this.findById(contestId);

    if (contest.status !== 'active') {
      throw new BadRequestException('Contest must be active to award scores');
    }

    // 1. Update Redis sorted set — this is the live score
    const newScore = await this.leaderboardService.addScore(
      contestId,
      dto.userId,
      dto.username,
      dto.points,
    );

    // 2. Broadcast the updated leaderboard to all subscribers in real-time
    // This is what makes the leaderboard update instantly in all browsers
    await this.leaderboardGateway.broadcastUpdate(contestId);

    return { newScore };
  }

  // Ends a contest — this is when Redis scores are synced to MongoDB
  // After this, the Redis keys are deleted and MongoDB has the permanent record
  async endContest(
    contestId: string,
    user: UserDocument,
  ): Promise<ContestDocument> {
    const contest = await this.findById(contestId);

    if (contest.createdBy.toString() !== user._id.toString()) {
      throw new ForbiddenException('Only the contest creator can end it');
    }

    if (contest.status === 'ended') {
      throw new BadRequestException('Contest is already ended');
    }

    // 1. Get the final leaderboard from Redis
    const finalLeaderboard = await this.leaderboardService.getAll(contestId);

    // 2. Sync final scores and ranks to MongoDB contest entries
    // bulkWrite does this in one DB round trip instead of N separate updates
    if (finalLeaderboard.length > 0) {
      await this.entryModel.bulkWrite(
        finalLeaderboard.map((entry) => ({
          updateOne: {
            filter: {
              contestId: new Types.ObjectId(contestId),
              userId: new Types.ObjectId(entry.userId),
            },
            update: {
              $set: {
                score: entry.score,
                rank: entry.rank,
              },
            },
          },
        })),
      );
    }

    // 3. Update contest status in MongoDB
    contest.status = 'ended';
    await contest.save();

    // 4. Clean up Redis keys — data is now safely in MongoDB
    await this.leaderboardService.clearContest(contestId);

    // 5. Broadcast final leaderboard one last time
    await this.leaderboardGateway.broadcastUpdate(contestId);

    return contest;
  }

  // Activates a contest — called by the interviewer when ready to start
  async activateContest(
    contestId: string,
    user: UserDocument,
  ): Promise<ContestDocument> {
    const contest = await this.findById(contestId);

    if (contest.createdBy.toString() !== user._id.toString()) {
      throw new ForbiddenException('Only the contest creator can activate it');
    }

    contest.status = 'active';
    return contest.save();
  }
}