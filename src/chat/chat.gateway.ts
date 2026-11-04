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
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Namespace, Server, Socket } from 'socket.io';
import { Throttle } from '@nestjs/throttler';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';
import { SocketAuthService } from '../common/ws/socket-auth.service';
import {
  DropWhenThrottled,
  WsThrottleGuard,
} from '../common/throttle/ws-throttle.guard';
import {
  WS_PIN_LIMIT,
  WS_SEND_LIMIT,
  WS_SUBSCRIBE_LIMIT,
  WS_TYPING_LIMIT,
} from '../common/throttle/limits';
import { WsExceptionsFilter } from '../common/filters/ws-exceptions.filter';
import { WsCurrentUser } from '../common/decorators/ws-current-user.decorator';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { RoomsService } from '../rooms/rooms.service';
import { SendMessageDto } from './dto/send-message.dto';
import { RoomEventDto } from './dto/room-event.dto';
import { PinQuestionWsDto } from './dto/pin-question-ws.dto';

/**
 * Real-time chat gateway. Connections are authenticated (and capped per user)
 * by SocketAuthService; every event is re-checked by WsJwtGuard and rate
 * limited per user by WsThrottleGuard.
 *
 * Events in:  room:join, room:leave, chat:send, chat:typing, chat:stop_typing,
 *             question:pin, question:unpin
 * Events out: chat:history, chat:message, chat:system, chat:typing,
 *             chat:stop_typing, question:pinned, question:unpinned
 */
@UseFilters(WsExceptionsFilter)
@UseGuards(WsJwtGuard, WsThrottleGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@WebSocketGateway({ namespace: '/chat' })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly roomsService: RoomsService,
    private readonly socketAuth: SocketAuthService,
  ) {}

  afterInit(namespace: Namespace): void {
    namespace.use(this.socketAuth.middleware());
  }

  handleConnection(client: Socket): void {
    this.logger.log(`WS connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`WS disconnected: ${client.id}`);
  }

  @Throttle(WS_SUBSCRIBE_LIMIT)
  @SubscribeMessage('room:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomEventDto,
    @WsCurrentUser() user: AuthUser,
  ) {
    const room = await this.findRoomForMember(body.roomId, user);
    await client.join(this.roomChannel(room.id));

    // Send chat history to the joining client only.
    const history = await this.chatService.history(room.id);
    client.emit(
      'chat:history',
      history.map((m) => this.serialize(m)),
    );

    // Ended rooms stay readable but accept no new messages, system ones included.
    if (room.state !== 'ended') {
      const sys = await this.chatService.create({
        roomId: room.id,
        senderId: null,
        senderName: 'system',
        content: `${user.username} joined the room`,
        type: 'system',
      });
      this.server
        .to(this.roomChannel(room.id))
        .emit('chat:system', this.serialize(sys));
    }

    return { ok: true, roomId: room.id, pinnedQuestion: room.pinnedQuestion };
  }

  @Throttle(WS_SUBSCRIBE_LIMIT)
  @SubscribeMessage('room:leave')
  async onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomEventDto,
    @WsCurrentUser() user: AuthUser,
  ) {
    const channel = this.roomChannel(body.roomId);
    // Only a socket that passed room:join can announce leaving.
    if (!client.rooms.has(channel)) return { ok: true };
    await client.leave(channel);

    const room = await this.roomsService.findByIdRaw(body.roomId);
    if (!room || room.state === 'ended') return { ok: true };
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

  @Throttle(WS_SEND_LIMIT)
  @SubscribeMessage('chat:send')
  async onMessage(
    @MessageBody() body: SendMessageDto,
    @WsCurrentUser() user: AuthUser,
  ) {
    const room = await this.findRoomForMember(body.roomId, user);
    if (room.state === 'ended') throw new WsException('Room has ended');

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

  // Typing events are high-frequency, so instead of a DB lookup they are only
  // relayed for sockets that already passed the membership check in room:join.
  @Throttle(WS_TYPING_LIMIT)
  @DropWhenThrottled()
  @SubscribeMessage('chat:typing')
  onTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomEventDto,
    @WsCurrentUser() user: AuthUser,
  ) {
    const channel = this.roomChannel(body.roomId);
    if (!client.rooms.has(channel)) return;
    client
      .to(channel)
      .emit('chat:typing', { userId: user.userId, username: user.username });
  }

  @Throttle(WS_TYPING_LIMIT)
  @DropWhenThrottled()
  @SubscribeMessage('chat:stop_typing')
  onStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomEventDto,
    @WsCurrentUser() user: AuthUser,
  ) {
    const channel = this.roomChannel(body.roomId);
    if (!client.rooms.has(channel)) return;
    client.to(channel).emit('chat:stop_typing', { userId: user.userId });
  }

  @Throttle(WS_PIN_LIMIT)
  @SubscribeMessage('question:pin')
  async onPin(
    @MessageBody() body: PinQuestionWsDto,
    @WsCurrentUser() user: AuthUser,
  ) {
    await this.assertRoomOwner(body.roomId, user);
    const room = await this.roomsService.pinQuestion(
      body.roomId,
      body.question ?? '',
    );
    this.server
      .to(this.roomChannel(body.roomId))
      .emit('question:pinned', { question: room.pinnedQuestion });
    return { ok: true };
  }

  @Throttle(WS_PIN_LIMIT)
  @SubscribeMessage('question:unpin')
  async onUnpin(
    @MessageBody() body: RoomEventDto,
    @WsCurrentUser() user: AuthUser,
  ) {
    await this.assertRoomOwner(body.roomId, user);
    await this.roomsService.unpinQuestion(body.roomId);
    this.server.to(this.roomChannel(body.roomId)).emit('question:unpinned', {});
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

  /**
   * Loads the room and requires the caller to be a member. A missing room and
   * a forbidden one get the same error, so room ids cannot be probed.
   */
  private async findRoomForMember(roomId: string, user: AuthUser) {
    const room = await this.roomsService.findByIdRaw(roomId);
    if (!room || !this.roomsService.isMember(room, user)) {
      throw new WsException('You are not a participant in this room');
    }
    return room;
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
