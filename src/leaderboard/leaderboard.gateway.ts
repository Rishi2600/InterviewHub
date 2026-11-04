import {
  Logger,
  UseFilters,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { InjectModel } from '@nestjs/mongoose';
import { IsString } from 'class-validator';
import { Model, Types } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';
import { WsExceptionsFilter } from '../common/filters/ws-exceptions.filter';
import { WsCurrentUser } from '../common/decorators/ws-current-user.decorator';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Contest } from '../contests/schemas/contest.schema';
import { ContestEntry } from '../contests/schemas/contest-entry.schema';
import { LeaderboardService } from './leaderboard.service';

class SubscribeDto {
  @IsString()
  contestId: string;
}

/**
 * Broadcasts leaderboard changes to everyone subscribed to a contest.
 * Clients subscribe with `leaderboard:join`; the ContestsService triggers
 * broadcasts through `broadcast()` on every score change.
 */
@UseFilters(WsExceptionsFilter)
@UseGuards(WsJwtGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/leaderboard' })
export class LeaderboardGateway {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(LeaderboardGateway.name);

  constructor(
    private readonly leaderboardService: LeaderboardService,
    @InjectModel(Contest.name) private readonly contestModel: Model<Contest>,
    @InjectModel(ContestEntry.name)
    private readonly entryModel: Model<ContestEntry>,
  ) {}

  private channel(contestId: string): string {
    return `contest:${contestId}`;
  }

  /** Owner, admin, or someone who joined the contest. */
  private async canWatch(contestId: string, user: AuthUser): Promise<boolean> {
    if (!Types.ObjectId.isValid(contestId)) return false;
    // Explicit ObjectIds, so the filters match whatever the schema casts.
    const id = new Types.ObjectId(contestId);
    if (user.role === 'admin') {
      return Boolean(await this.contestModel.exists({ _id: id }));
    }
    const userId = new Types.ObjectId(user.userId);
    const [owned, joined] = await Promise.all([
      this.contestModel.exists({ _id: id, ownerId: userId }),
      this.entryModel.exists({ contestId: id, userId }),
    ]);
    return Boolean(owned || joined);
  }

  @SubscribeMessage('leaderboard:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SubscribeDto,
    @WsCurrentUser() user: AuthUser,
  ) {
    // Missing and forbidden contests get the same error, so ids cannot be probed.
    if (!(await this.canWatch(body.contestId, user))) {
      throw new WsException('You are not part of this contest');
    }
    await client.join(this.channel(body.contestId));
    const top = await this.leaderboardService.getTopN(body.contestId, 10);
    client.emit('leaderboard:update', { contestId: body.contestId, top });
    return { ok: true };
  }

  @SubscribeMessage('leaderboard:leave')
  async onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SubscribeDto,
  ) {
    await client.leave(this.channel(body.contestId));
    return { ok: true };
  }

  /** Called by ContestsService after a score changes. */
  async broadcast(contestId: string): Promise<void> {
    if (!this.server) return;
    const top = await this.leaderboardService.getTopN(contestId, 10);
    this.server
      .to(this.channel(contestId))
      .emit('leaderboard:update', { contestId, top });
  }
}
