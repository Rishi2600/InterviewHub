import { ValidationPipe } from '@nestjs/common';
import { RegisterDto } from '../../auth/dto/register.dto';
import { LoginDto } from '../../auth/dto/login.dto';
import { CreateRoomDto } from '../../rooms/dto/create-room.dto';
import { SendMessageDto } from '../../chat/dto/send-message.dto';
import { ScoreDto } from '../../contests/dto/score.dto';
import { WS_VALIDATION } from './limits';

// The same options main.ts and the gateways use.
const pipe = new ValidationPipe(WS_VALIDATION);
const check = (metatype: new () => object, value: object) =>
  pipe.transform(value, { type: 'body', metatype });

const ROOM_ID = '64b7f0f0f0f0f0f0f0f0f0f0';

describe('input limits', () => {
  it('rejects unknown fields instead of dropping them', async () => {
    await expect(
      check(CreateRoomDto, { title: 'Pairing', admin: true }),
    ).rejects.toThrow();
  });

  it('trims titles and usernames and holds them to their lengths', async () => {
    await expect(
      check(CreateRoomDto, { title: '  Pairing  ' }),
    ).resolves.toEqual({ title: 'Pairing' });
    await expect(
      check(CreateRoomDto, { title: 'x'.repeat(81) }),
    ).rejects.toThrow();
    await expect(check(CreateRoomDto, { title: '  a ' })).rejects.toThrow();
    await expect(
      check(RegisterDto, {
        username: 'u'.repeat(33),
        email: 'a@example.com',
        password: 'Quiet-river9',
      }),
    ).rejects.toThrow();
  });

  it('caps login fields without applying the password policy', async () => {
    await expect(
      check(LoginDto, { email: 'a@example.com', password: 'old6ch' }),
    ).resolves.toBeTruthy();
    await expect(
      check(LoginDto, { email: 'a@example.com', password: 'x'.repeat(129) }),
    ).rejects.toThrow();
  });

  it('requires real ids in socket payloads and caps message length', async () => {
    await expect(
      check(SendMessageDto, { roomId: 'room-1', content: 'hi' }),
    ).rejects.toThrow();
    await expect(
      check(SendMessageDto, { roomId: ROOM_ID, content: 'x'.repeat(2001) }),
    ).rejects.toThrow();
    await expect(
      check(SendMessageDto, { roomId: ROOM_ID, content: 'hi' }),
    ).resolves.toBeTruthy();
  });

  it('bounds a manual score change', async () => {
    await expect(
      check(ScoreDto, { userId: ROOM_ID, delta: 1001 }),
    ).rejects.toThrow();
    await expect(
      check(ScoreDto, { userId: ROOM_ID, delta: -1000 }),
    ).resolves.toBeTruthy();
  });
});
