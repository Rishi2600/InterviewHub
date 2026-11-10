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
  WS_CALL_STATE_LIMIT,
  WS_PIN_LIMIT,
  WS_SEND_LIMIT,
  WS_SIGNAL_LIMIT,
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
import { LIMITS, WS_VALIDATION } from '../common/validation/limits';
import { CallSignalDto, CallStateDto } from './dto/call.dto';

/** What a socket in a call shares with the others in it. */
interface CallState {
  roomId: string;
  mic: boolean;
  cam: boolean;
  sharing: boolean;
  screenId?: string;
}

type CallSocket = Pick<Socket, 'id'> & {
  data: { user?: AuthUser; call?: CallState };
};

/**
 * Real-time chat gateway. Connections are authenticated (and capped per user)
 * by SocketAuthService; every event is re-checked by WsJwtGuard and rate
 * limited per user by WsThrottleGuard.
 *
 * Events in:  room:join, room:leave, chat:send, chat:typing, chat:stop_typing,
 *             question:pin, question:unpin,
 *             call:join, call:leave, call:signal, call:state
 * Events out: chat:history, chat:message, chat:system, chat:typing,
 *             chat:stop_typing, question:pinned, question:unpinned,
 *             room:ended, call:peer-joined, call:peer-left, call:signal,
 *             call:state, call:replaced
 *
 * Calls are peer to peer: the server only relays WebRTC messages between
 * the people in a room's call, up to LIMITS.callMax of them. See
 * docs/learning/webrtc/.
 */
@UseFilters(WsExceptionsFilter)
@UseGuards(WsJwtGuard, WsThrottleGuard)
@UsePipes(new ValidationPipe(WS_VALIDATION))
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
    // An ended room is read-only and its call is over, for everyone in it.
    this.roomsService.ended$.subscribe((roomId) => {
      namespace.to(this.roomChannel(roomId)).emit('room:ended', { roomId });
      namespace
        .in(this.callChannel(roomId))
        .socketsLeave(this.callChannel(roomId));
    });
  }

  handleConnection(client: Socket): void {
    this.logger.log(`WS connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`WS disconnected: ${client.id}`);
    const call = (client as CallSocket).data.call;
    if (call) {
      this.server
        .to(this.callChannel(call.roomId))
        .emit('call:peer-left', { socketId: client.id });
    }
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

    // Announced once per user. Ended rooms stay readable but accept no new
    // messages, system ones included.
    if (
      room.state !== 'ended' &&
      (await this.roomsService.markAnnounced(room.id, user.userId))
    ) {
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
  // Leaving a page is not leaving the room, so nothing is posted: "joined"
  // appears once per user, and a "left" on every visit would not match it.
  @SubscribeMessage('room:leave')
  async onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomEventDto,
  ) {
    await client.leave(this.roomChannel(body.roomId));
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
   * Joins the room's call. The answer lists who is already in it; they are
   * told about the newcomer, who then offers a connection to each of them.
   * Each user has one place in a call: a reload or a second tab takes over
   * the old one.
   */
  @Throttle(WS_SUBSCRIBE_LIMIT)
  @SubscribeMessage('call:join')
  async onCallJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomEventDto,
    @WsCurrentUser() user: AuthUser,
  ) {
    const room = await this.findRoomForMember(body.roomId, user);
    if (room.state === 'ended') throw new WsException('Room has ended');
    if (!client.rooms.has(this.roomChannel(room.id))) {
      throw new WsException('Join the room first');
    }
    const channel = this.callChannel(room.id);
    const inCall = (await this.server.in(channel).fetchSockets()).filter(
      (s) => s.id !== client.id,
    );
    const mine = inCall.filter(
      (s) => (s as CallSocket).data.user?.userId === user.userId,
    );
    const others = inCall.filter((s) => !mine.includes(s));
    if (others.length >= LIMITS.callMax) {
      throw new WsException(`The call is full (${LIMITS.callMax} people)`);
    }
    for (const old of mine) {
      old.leave(channel);
      old.emit('call:replaced', { roomId: room.id });
      this.server.to(channel).emit('call:peer-left', { socketId: old.id });
    }

    const call: CallState = {
      roomId: room.id,
      mic: true,
      cam: true,
      sharing: false,
    };
    (client as CallSocket).data.call = call;
    await client.join(channel);
    client
      .to(channel)
      .emit(
        'call:peer-joined',
        this.peer({ id: client.id, data: { user, call } }),
      );
    return {
      ok: true,
      peers: others.map((s) => this.peer(s as CallSocket)),
    };
  }

  @Throttle(WS_SUBSCRIBE_LIMIT)
  @SubscribeMessage('call:leave')
  async onCallLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomEventDto,
  ) {
    const channel = this.callChannel(body.roomId);
    (client as CallSocket).data.call = undefined;
    await client.leave(channel);
    this.server.to(channel).emit('call:peer-left', { socketId: client.id });
    return { ok: true };
  }

  /**
   * Relays an offer, answer or network candidate to one other person, only
   * if both are in the same call. Nothing is stored.
   */
  @Throttle(WS_SIGNAL_LIMIT)
  @DropWhenThrottled()
  @SubscribeMessage('call:signal')
  async onCallSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: CallSignalDto,
  ) {
    const channel = this.callChannel(body.roomId);
    if (!client.rooms.has(channel) || body.to === client.id) return;
    const inCall = await this.server.in(channel).fetchSockets();
    if (!inCall.some((s) => s.id === body.to)) return;
    this.server.to(body.to).emit('call:signal', {
      from: client.id,
      description: body.description,
      candidate: body.candidate,
    });
  }

  /** Mute, camera and screen share, for the others' tiles. */
  @Throttle(WS_CALL_STATE_LIMIT)
  @SubscribeMessage('call:state')
  onCallState(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: CallStateDto,
  ) {
    const channel = this.callChannel(body.roomId);
    const call = (client as CallSocket).data.call;
    if (!client.rooms.has(channel) || !call) return;
    Object.assign(call, {
      mic: body.mic,
      cam: body.cam,
      sharing: body.sharing,
      screenId: body.screenId,
    });
    client.to(channel).emit('call:state', { socketId: client.id, ...body });
  }

  private peer(s: CallSocket) {
    const { user, call } = s.data;
    return {
      socketId: s.id,
      userId: user?.userId,
      username: user?.username,
      role: user?.role,
      mic: call?.mic ?? true,
      cam: call?.cam ?? true,
      sharing: call?.sharing ?? false,
      screenId: call?.screenId,
    };
  }

  private callChannel(roomId: string): string {
    return `call:${roomId}`;
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
