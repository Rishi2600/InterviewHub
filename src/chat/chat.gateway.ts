import { Logger, UseFilters, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';
import { WsExceptionsFilter } from '../common/filters/ws-exceptions.filter';
import { WsCurrentUser } from '../common/decorators/ws-current-user.decorator';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { RoomsService } from '../rooms/rooms.service';
import { SendMessageDto } from './dto/send-message.dto';
import { RoomEventDto } from './dto/room-event.dto';
import { PinQuestionWsDto } from './dto/pin-question-ws.dto';

/**
 * Real-time chat gateway. Every handler is authenticated via WsJwtGuard, which
 * runs on the handshake and attaches the user to client.data.user.
 *
 * Events in:  room:join, room:leave, chat:send, chat:typing, chat:stop_typing,
 *             question:pin, question:unpin
 * Events out: chat:history, chat:message, chat:system, chat:typing,
 *             chat:stop_typing, question:pinned, question:unpinned
 */
@UseFilters(WsExceptionsFilter)
@UseGuards(WsJwtGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly roomsService: RoomsService,
  ) {}

  handleConnection(client: Socket): void {
    this.logger.log(`WS connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`WS disconnected: ${client.id}`);
  }

  @SubscribeMessage('room:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomEventDto,
    @WsCurrentUser() user: AuthUser,
  ) {
    const room = await this.roomsService.findById(body.roomId);
    await client.join(this.roomChannel(room.id));

    // Send chat history to the joining client only.
    const history = await this.chatService.history(room.id);
    client.emit(
      'chat:history',
      history.map((m) => this.serialize(m)),
    );

    // Broadcast a system join message to everyone in the room.
    const sys = await this.chatService.create({
      roomId: room.id,
      senderId: null,
      senderName: 'system',
      content: `${user.username} joined the room`,
      type: 'system',
    });
    this.server.to(this.roomChannel(room.id)).emit('chat:system', this.serialize(sys));

    return { ok: true, roomId: room.id, pinnedQuestion: room.pinnedQuestion };
  }

  @SubscribeMessage('room:leave')
  async onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomEventDto,
    @WsCurrentUser() user: AuthUser,
  ) {
    const channel = this.roomChannel(body.roomId);
    await client.leave(channel);
    const sys = await this.chatService.create({
      roomId: body.roomId,
      senderId: null,
      senderName: 'system',
      content: `${user.username} left the room`,
      type: 'system',
    });
    this.server.to(channel).emit('chat:system', this.serialize(sys));
    return { ok: true };
  }

  @SubscribeMessage('chat:send')
  async onMessage(
    @MessageBody() body: SendMessageDto,
    @WsCurrentUser() user: AuthUser,
  ) {
    const msg = await this.chatService.create({
      roomId: body.roomId,
      senderId: user.userId,
      senderName: user.username, // denormalized
      content: body.content,
      type: 'user',
    });
    this.server
      .to(this.roomChannel(body.roomId))
      .emit('chat:message', this.serialize(msg));
    return { ok: true, id: msg.id };
  }

  @SubscribeMessage('chat:typing')
  onTyping(@MessageBody() body: RoomEventDto, @WsCurrentUser() user: AuthUser) {
    this.server
      .to(this.roomChannel(body.roomId))
      .emit('chat:typing', { userId: user.userId, username: user.username });
  }

  @SubscribeMessage('chat:stop_typing')
  onStopTyping(@MessageBody() body: RoomEventDto, @WsCurrentUser() user: AuthUser) {
    this.server
      .to(this.roomChannel(body.roomId))
      .emit('chat:stop_typing', { userId: user.userId });
  }

  @SubscribeMessage('question:pin')
  async onPin(
    @MessageBody() body: PinQuestionWsDto,
    @WsCurrentUser() user: AuthUser,
  ) {
    await this.assertRoomOwner(body.roomId, user);
    const room = await this.roomsService.pinQuestion(body.roomId, body.question ?? '');
    this.server
      .to(this.roomChannel(body.roomId))
      .emit('question:pinned', { question: room.pinnedQuestion });
    return { ok: true };
  }

  @SubscribeMessage('question:unpin')
  async onUnpin(
    @MessageBody() body: RoomEventDto,
    @WsCurrentUser() user: AuthUser,
  ) {
    await this.assertRoomOwner(body.roomId, user);
    await this.roomsService.unpinQuestion(body.roomId);
    this.server
      .to(this.roomChannel(body.roomId))
      .emit('question:unpinned', {});
    return { ok: true };
  }

  /**
   * Socket-side counterpart to RoomOwnerGuard. The HTTP pin/unpin routes are
   * guarded there; without this the gateway would let any authenticated
   * participant pin. Throws before any mutation, so the room is left untouched
   * and WsExceptionsFilter emits 'error' to the caller.
   */
  private async assertRoomOwner(roomId: string, user: AuthUser): Promise<void> {
    const room = await this.roomsService.findById(roomId);
    if (!this.roomsService.isOwnedBy(room, user)) {
      throw new WsException('You do not own this room');
    }
  }

  private roomChannel(roomId: string): string {
    return `room:${roomId}`;
  }

  private serialize(m: {
    id: string;
    roomId: any;
    senderId: any;
    senderName: string;
    content: string;
    type: string;
    createdAt?: Date;
  }) {
    return {
      id: m.id,
      roomId: m.roomId?.toString?.() ?? m.roomId,
      senderId: m.senderId ? m.senderId.toString() : null,
      senderName: m.senderName,
      content: m.content,
      type: m.type,
      createdAt: (m as any).createdAt ?? new Date(),
    };
  }
}
