import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import { WsException } from '@nestjs/websockets';
import {
  DropWhenThrottled,
  DroppedEventException,
  WsThrottleGuard,
} from './ws-throttle.guard';
import { THROTTLERS, WS_SEND_LIMIT, WS_TYPING_LIMIT } from './limits';
import { WsExceptionsFilter } from '../filters/ws-exceptions.filter';

class FakeGateway {
  @Throttle(WS_SEND_LIMIT)
  send() {}

  @Throttle(WS_TYPING_LIMIT)
  @DropWhenThrottled()
  typing() {}
}

const handler = (name: keyof FakeGateway) =>
  Reflect.get(FakeGateway.prototype, name);

function wsContext(
  name: keyof FakeGateway,
  userId: string,
  socketId = 's1',
): ExecutionContext {
  const client = { id: socketId, data: { user: { userId } } };
  return {
    getType: () => 'ws',
    getHandler: () => handler(name),
    getClass: () => FakeGateway,
    switchToWs: () => ({ getClient: () => client }),
  } as unknown as ExecutionContext;
}

describe('WsThrottleGuard', () => {
  let guard: WsThrottleGuard;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot({ throttlers: THROTTLERS })],
      providers: [WsThrottleGuard],
    }).compile();
    await moduleRef.init();
    guard = moduleRef.get(WsThrottleGuard);
  });

  const send = (userId: string, socketId?: string) =>
    guard.canActivate(wsContext('send', userId, socketId));

  it('allows 5 chat:send in 5 s, then answers "Slow down"', async () => {
    for (let i = 0; i < 5; i++) await expect(send('u1')).resolves.toBe(true);
    await expect(send('u1')).rejects.toThrow(new WsException('Slow down'));
  });

  it('counts per user, across all of their sockets', async () => {
    for (let i = 0; i < 5; i++) await send('u1', `socket-${i}`);
    await expect(send('u1', 'another-socket')).rejects.toThrow(WsException);
    await expect(send('u2')).resolves.toBe(true);
  });

  it('drops typing events quietly once over the limit', async () => {
    const typing = () => guard.canActivate(wsContext('typing', 'u1'));
    await typing();
    await typing();
    await expect(typing()).rejects.toBeInstanceOf(DroppedEventException);
  });

  it('ignores HTTP requests', async () => {
    const http = {
      ...wsContext('send', 'u1'),
      getType: () => 'http',
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(http)).resolves.toBe(true);
  });
});

describe('WsExceptionsFilter with throttled events', () => {
  const hostFor = (emit: jest.Mock) =>
    ({
      switchToWs: () => ({ getClient: () => ({ emit }) }),
    }) as never;

  it('sends nothing for a dropped event, and an error for "Slow down"', () => {
    const filter = new WsExceptionsFilter();
    const emit = jest.fn();
    filter.catch(new DroppedEventException(), hostFor(emit));
    expect(emit).not.toHaveBeenCalled();

    filter.catch(new WsException('Slow down'), hostFor(emit));
    expect(emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ message: 'Slow down' }),
    );
  });
});
