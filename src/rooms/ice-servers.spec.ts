import { createHmac } from 'node:crypto';
import { iceConfigFrom, iceServers } from './ice-servers';

const NOW = new Date('2026-11-10T12:00:00Z');
const config = (values: Record<string, unknown>) =>
  iceConfigFrom({ get: (key) => values[key] });

describe('iceServers', () => {
  it('gives no servers when none are set up, which works on one network', () => {
    expect(iceServers(config({}), 'u1', NOW)).toEqual({
      iceServers: [],
      ttlSeconds: 3_600,
    });
  });

  it('lists STUN servers as given', () => {
    const { iceServers: servers } = iceServers(
      config({ STUN_URLS: 'stun:turn.example.com:3478' }),
      'u1',
      NOW,
    );
    expect(servers).toEqual([{ urls: ['stun:turn.example.com:3478'] }]);
  });

  it('signs TURN credentials that coturn can check and that expire', () => {
    const { iceServers: servers } = iceServers(
      config({
        TURN_URLS:
          'turn:t.example.com:3478?transport=udp, turn:t.example.com:3478?transport=tcp',
        TURN_SECRET: 'a-long-shared-secret',
        TURN_TTL_SECONDS: 600,
      }),
      'u1',
      NOW,
    );
    const expiry = NOW.getTime() / 1_000 + 600;
    expect(servers).toEqual([
      {
        urls: [
          'turn:t.example.com:3478?transport=udp',
          'turn:t.example.com:3478?transport=tcp',
        ],
        username: `${expiry}:u1`,
        credential: createHmac('sha1', 'a-long-shared-secret')
          .update(`${expiry}:u1`)
          .digest('base64'),
      },
    ]);
  });

  it('leaves TURN out without a secret', () => {
    const { iceServers: servers } = iceServers(
      config({ TURN_URLS: 'turn:t.example.com:3478' }),
      'u1',
      NOW,
    );
    expect(servers).toEqual([]);
  });
});
