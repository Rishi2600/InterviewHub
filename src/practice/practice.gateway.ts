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
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Throttle } from '@nestjs/throttler';
import { Types } from 'mongoose';
import { Namespace, Socket } from 'socket.io';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';
import { WsThrottleGuard } from '../common/throttle/ws-throttle.guard';
import {
  WS_PRACTICE_RUN_LIMIT,
  WS_SEND_LIMIT,
  WS_SUBSCRIBE_LIMIT,
} from '../common/throttle/limits';
import { WS_VALIDATION } from '../common/validation/limits';
import { WsExceptionsFilter } from '../common/filters/ws-exceptions.filter';
import { WsCurrentUser } from '../common/decorators/ws-current-user.decorator';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { SocketAuthService } from '../common/ws/socket-auth.service';
import { PracticeConversationService } from './practice-conversation.service';
import { PracticeNotifier } from './practice.notifier';
import { PracticeService } from './practice.service';
import { interviewView } from './practice.views';
import {
  PracticeAnswerDto,
  PracticeJoinDto,
  PracticeRunDto,
} from './dto/practice-ws.dto';

/**
 * The live side of a practice interview, for its candidate only.
 *
 * Events in:  practice:join, practice:answer, practice:run
 * Events out: practice:turn, practice:delta, practice:question,
 *             practice:retracted, practice:failed, practice:ended,
 *             practice:feedback
 */
@UseFilters(WsExceptionsFilter)
@UseGuards(WsJwtGuard, WsThrottleGuard)
@UsePipes(new ValidationPipe(WS_VALIDATION))
@WebSocketGateway({ namespace: '/practice' })
export class PracticeGateway implements OnGatewayInit {
  private readonly logger = new Logger(PracticeGateway.name);

  constructor(
    private readonly practice: PracticeService,
    private readonly conversation: PracticeConversationService,
    private readonly notifier: PracticeNotifier,
    private readonly socketAuth: SocketAuthService,
  ) {}

  afterInit(namespace: Namespace): void {
    namespace.use(this.socketAuth.middleware());
    this.notifier.server = namespace;
  }

  /** Watches the interview; the first open starts the AI's greeting. */
  @Throttle(WS_SUBSCRIBE_LIMIT)
  @SubscribeMessage('practice:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: PracticeJoinDto,
    @WsCurrentUser() user: AuthUser,
  ) {
    const iv = await this.practice.owned(body.interviewId, user);
    await client.join(PracticeNotifier.room(body.interviewId));
    if (iv.status === 'active' && iv.turns.length === 0) {
      this.conversation
        .open(iv._id, iv.userId)
        .catch((err: Error) => this.logger.error(err.message));
    }
    return { ok: true, interview: interviewView(iv) };
  }

  /** Acks once the AI's reply is done, or with why it couldn't reply. */
  @Throttle(WS_SEND_LIMIT)
  @SubscribeMessage('practice:answer')
  onAnswer(
    @MessageBody() body: PracticeAnswerDto,
    @WsCurrentUser() user: AuthUser,
  ) {
    return this.conversation.answer(
      body.interviewId,
      new Types.ObjectId(user.userId),
      { text: body.text, code: body.code },
    );
  }

  @Throttle(WS_PRACTICE_RUN_LIMIT)
  @SubscribeMessage('practice:run')
  async onRun(
    @MessageBody() body: PracticeRunDto,
    @WsCurrentUser() user: AuthUser,
  ) {
    const { interviewId, ...run } = body;
    await this.conversation.run(
      interviewId,
      new Types.ObjectId(user.userId),
      run,
    );
    return { ok: true };
  }
}
