import {
  OnModuleDestroy,
  UseFilters,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { InjectModel } from '@nestjs/mongoose';
import { IsMongoId } from 'class-validator';
import { Model, Types } from 'mongoose';
import { Namespace, Socket } from 'socket.io';
import { Throttle } from '@nestjs/throttler';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';
import { SocketAuthService } from '../common/ws/socket-auth.service';
import { WsThrottleGuard } from '../common/throttle/ws-throttle.guard';
import { WS_SUBSCRIBE_LIMIT } from '../common/throttle/limits';
import { WS_VALIDATION } from '../common/validation/limits';
import { WsExceptionsFilter } from '../common/filters/ws-exceptions.filter';
import { WsCurrentUser } from '../common/decorators/ws-current-user.decorator';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Contest } from './schemas/contest.schema';
import { ContestEntry } from './schemas/contest-entry.schema';

class WatchDto {
  @IsMongoId()
  contestId: string;
}

export interface ContestCounts {
  contestId: string;
  entrantCount: number;
  startedCount: number;
  submittedCount: number;
}

// Counts change on every join, start and submit; send at most one update
// per contest per this long.
const COUNTS_EVERY_MS = 1_000;
const BOARD_SIZE = 10;

/**
 * Live updates for a contest page. Clients `contest:watch` a contest and
 * get `contest:counts` while it runs (entered, started, submitted; never
 * scores) and `contest:finalized` with the top of the board once results
 * are out. With Redis on, broadcasts reach clients on every server.
 */
@UseFilters(WsExceptionsFilter)
@UseGuards(WsJwtGuard, WsThrottleGuard)
@UsePipes(new ValidationPipe(WS_VALIDATION))
@WebSocketGateway({ namespace: '/contests' })
export class ContestsGateway implements OnGatewayInit, OnModuleDestroy {
  @WebSocketServer() server: Namespace;
  private readonly pending = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectModel(Contest.name) private readonly contestModel: Model<Contest>,
    @InjectModel(ContestEntry.name)
    private readonly entryModel: Model<ContestEntry>,
    private readonly socketAuth: SocketAuthService,
  ) {}

  afterInit(namespace: Namespace): void {
    namespace.use(this.socketAuth.middleware());
  }

  onModuleDestroy(): void {
    for (const timer of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
  }

  private room(contestId: string): string {
    return `contest:${contestId}`;
  }

  /** Any signed-in user may watch a published or cancelled contest; a
   *  draft only its host and admins. Missing and hidden look the same. */
  private async findWatchable(contestId: string, user: AuthUser) {
    if (!Types.ObjectId.isValid(contestId)) return null;
    const contest = await this.contestModel
      .findById(contestId)
      .select('status hostId entrantCount startedCount submittedCount')
      .lean()
      .exec();
    if (!contest) return null;
    const host =
      user.role === 'admin' || contest.hostId.toString() === user.userId;
    return contest.status === 'draft' && !host ? null : contest;
  }

  @Throttle(WS_SUBSCRIBE_LIMIT)
  @SubscribeMessage('contest:watch')
  async onWatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: WatchDto,
    @WsCurrentUser() user: AuthUser,
  ) {
    const contest = await this.findWatchable(body.contestId, user);
    if (!contest) throw new WsException('Contest not found');
    await client.join(this.room(body.contestId));
    const counts: ContestCounts = {
      contestId: body.contestId,
      entrantCount: contest.entrantCount,
      startedCount: contest.startedCount,
      submittedCount: contest.submittedCount,
    };
    return { ok: true, counts };
  }

  @Throttle(WS_SUBSCRIBE_LIMIT)
  @SubscribeMessage('contest:unwatch')
  async onUnwatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: WatchDto,
  ) {
    await client.leave(this.room(body.contestId));
    return { ok: true };
  }

  /**
   * Called after a join, leave, start or submit. Coalesces bursts into one
   * update per second, read fresh from the database so it is always right.
   */
  countsChanged(contestId: string): void {
    if (!this.server || this.pending.has(contestId)) return;
    const timer = setTimeout(() => {
      this.pending.delete(contestId);
      void this.sendCounts(contestId);
    }, COUNTS_EVERY_MS);
    timer.unref();
    this.pending.set(contestId, timer);
  }

  private async sendCounts(contestId: string): Promise<void> {
    const c = await this.contestModel
      .findById(contestId)
      .select('entrantCount startedCount submittedCount')
      .lean()
      .exec();
    if (!c) return;
    const counts: ContestCounts = {
      contestId,
      entrantCount: c.entrantCount,
      startedCount: c.startedCount,
      submittedCount: c.submittedCount,
    };
    this.server.to(this.room(contestId)).emit('contest:counts', counts);
  }

  /** Called once a contest's results are out. */
  async finalized(contestId: string): Promise<void> {
    if (!this.server) return;
    const top = await this.entryModel
      .find({ contestId: new Types.ObjectId(contestId), rank: { $ne: null } })
      .select('userId username rank score timeUsedMs autoSubmitted')
      .sort({ rank: 1, username: 1, _id: 1 })
      .limit(BOARD_SIZE)
      .lean()
      .exec();
    this.server
      .to(this.room(contestId))
      .emit('contest:finalized', { contestId, top });
  }
}
