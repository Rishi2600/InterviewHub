//@ts-nocheck

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { LeaderboardService } from '../leaderboard.service';
import { WsJwtGuard } from '../../common/ws-jwt.guard';

@WebSocketGateway({ cors: true })
export class LeaderboardGateway {
  @WebSocketServer()
  server: Server;

  constructor(private leaderboardService: LeaderboardService) {}

  // EVENT: leaderboard:join
  // Client emits this to subscribe to a contest's leaderboard updates
  // They join a dedicated Socket.io room for this contest
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leaderboard:join')
  async handleJoin(
    @MessageBody() data: { contestId: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Join the leaderboard room for this contest
    // Room name pattern: leaderboard:{contestId}
    await client.join(`leaderboard:${data.contestId}`);

    // Send the current leaderboard immediately on join
    const leaderboard = await this.leaderboardService.getTopN(data.contestId);
    client.emit('leaderboard:update', leaderboard);
  }

  // Called by ContestsService (not by clients directly) after a score is awarded
  // Fetches the latest leaderboard from Redis and broadcasts to all subscribers
  async broadcastUpdate(contestId: string): Promise<void> {
    const leaderboard = await this.leaderboardService.getTopN(contestId);

    // Emit to everyone subscribed to this contest's leaderboard room
    this.server
      .to(`leaderboard:${contestId}`)
      .emit('leaderboard:update', leaderboard);
  }
}