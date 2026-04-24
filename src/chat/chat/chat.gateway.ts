//@ts-nocheck

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from '../chat.service';
import { RoomsService } from '../../rooms/rooms.service';
import { WsJwtGuard } from '../../common/ws-jwt.guard';
import { SendMessageDto } from '../dto/send-message.dto';

// cors: true — allow connections from any origin during development
@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  // @WebSocketServer() injects the raw Socket.io Server instance
  // We use this to broadcast events to entire rooms
  @WebSocketServer()
  server: Server;

  constructor(
    private chatService: ChatService,
    private roomsService: RoomsService,
  ) {}

  // Fires when any socket connects — before any guard runs
  // We just log here; auth happens per-event via WsJwtGuard
  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  // Fires when a socket disconnects (tab closed, network drop, etc.)
  // We notify the room that this user left
  async handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);

    // client.data.user is set by WsJwtGuard when they first joined a room
    // client.data.roomId is set when they emit room:join
    const user = client.data?.user;
    const roomId = client.data?.roomId;

    if (user && roomId) {
      // Notify everyone still in the room
      this.server.to(roomId).emit('room:user_left', {
        userId: user._id,
        username: user.username,
      });
    }
  }

  // EVENT: room:join
  // Client emits this after connecting to enter a specific room
  // Payload: { roomId: string }
  // This is where WsJwtGuard runs — verifies the JWT from the handshake
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('room:join')
  async handleRoomJoin(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;

    // Socket.io rooms — client.join(roomId) means this socket
    // will receive any event emitted to server.to(roomId)
    await client.join(data.roomId);

    // Store on the socket so handleDisconnect can access it
    client.data.roomId = data.roomId;

    // Load message history from MongoDB and send only to this client
    const history = await this.chatService.getHistory(data.roomId);
    client.emit('chat:history', history);

    // Save and broadcast a system message to the whole room
    const systemMsg = await this.chatService.saveSystemMessage(
      data.roomId,
      `${user.username} joined the room`,
    );

    // to(roomId) broadcasts to everyone in the room INCLUDING the sender
    this.server.to(data.roomId).emit('chat:message', systemMsg);

    // Tell everyone who just joined
    this.server.to(data.roomId).emit('room:user_joined', {
      userId: user._id,
      username: user.username,
      role: user.role,
    });
  }

  // EVENT: room:leave
  // Client emits this when they intentionally leave (not a disconnect)
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('room:leave')
  async handleRoomLeave(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;

    client.leave(data.roomId);

    this.server.to(data.roomId).emit('room:user_left', {
      userId: user._id,
      username: user.username,
    });
  }

  // EVENT: chat:send
  // Client emits this to send a message
  // Payload: SendMessageDto { roomId, content, type }
  // Flow: validate → save to MongoDB → broadcast to room
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('chat:send')
  async handleMessage(
    @MessageBody() dto: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;

    // Persist to MongoDB first — if this fails, nothing is broadcast
    const message = await this.chatService.saveMessage(dto, user);

    // Broadcast to everyone in the room including the sender
    // The client uses this to render the message in the UI
    this.server.to(dto.roomId).emit('chat:message', message);
  }

  // EVENT: chat:typing
  // Client emits while the user is typing — debounce this on the client side
  // We don't save this to MongoDB — purely ephemeral real-time signal
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('chat:typing')
  handleTyping(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;

    // broadcast.to() sends to everyone in the room EXCEPT the sender
    // You don't need to see your own "is typing" indicator
    client.broadcast.to(data.roomId).emit('chat:typing', {
      userId: user._id,
      username: user.username,
    });
  }

  // EVENT: chat:stop_typing
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('chat:stop_typing')
  handleStopTyping(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    client.broadcast.to(data.roomId).emit('chat:stop_typing', {
      userId: user._id,
    });
  }

  // EVENT: question:pin
  // Only interviewers should call this — enforced inside the service
  // Payload: { roomId, messageId }
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('question:pin')
  async handlePinQuestion(
    @MessageBody() data: { roomId: string; messageId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const pinned = await this.chatService.pinQuestion(data.messageId);

    // Update the room's pinnedQuestion reference in MongoDB
    await this.roomsService.pinQuestion(data.roomId, data.messageId);

    // Broadcast the pinned question to everyone in the room
    // The candidate's UI should highlight this prominently
    this.server.to(data.roomId).emit('question:pinned', pinned);
  }

  // EVENT: question:unpin
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('question:unpin')
  async handleUnpinQuestion(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    await this.chatService.unpinQuestion(data.roomId);
    await this.roomsService.unpinQuestion(data.roomId);

    this.server.to(data.roomId).emit('question:unpinned', {
      roomId: data.roomId,
    });
  }
}