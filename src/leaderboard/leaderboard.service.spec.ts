//@ts-nocheck

import { LeaderboardService } from './leaderboard.service';

describe('LeaderboardService (in-memory fallback)', () => {
  let service: LeaderboardService;

  beforeEach(() => {
    // null Redis client -> in-memory Map backend
    service = new LeaderboardService(null);
  });

  it('increments scores atomically', async () => {
    await service.addScore('c1', 'u1', 10);
    const total = await service.addScore('c1', 'u1', 5);
    expect(total).toBe(15);
  });

  it('ranks users highest-first', async () => {
    await service.addScore('c1', 'u1', 10);
    await service.addScore('c1', 'u2', 30);
    await service.addScore('c1', 'u3', 20);
    const top = await service.getTopN('c1', 3);
    expect(top.map((e) => e.userId)).toEqual(['u2', 'u3', 'u1']);
    expect(top[0].rank).toBe(1);
  });

  it('clears a contest board', async () => {
    await service.addScore('c1', 'u1', 10);
    await service.clear('c1');
    const top = await service.getTopN('c1', 10);
    expect(top).toHaveLength(0);
  });
});
