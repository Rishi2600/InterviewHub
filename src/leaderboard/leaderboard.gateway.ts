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
} from '@nestjs/websockets';
import { IsString } from 'class-validator';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';
import { WsExceptionsFilter } from '../common/filters/ws-exceptions.filter';
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

  constructor(private readonly leaderboardService: LeaderboardService) {}

  private channel(contestId: string): string {
    return `contest:${contestId}`;
  }

  @SubscribeMessage('leaderboard:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SubscribeDto,
  ) {
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
