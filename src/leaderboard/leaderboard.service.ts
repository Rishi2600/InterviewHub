import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

export interface LeaderboardEntry {
  userId: string;
  score: number;
  rank: number;
}

/**
 * Live leaderboard scoring. Backed by a Redis sorted set when Redis is enabled
 * (ZINCRBY for atomic increments, ZREVRANGE for ranked reads), and by an
 * in-memory Map when it is not. The public API is identical either way, so the
 * rest of the app never needs to know which backend is active.
 */
@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);
  // Fallback store: contestId -> (userId -> score)
  private readonly memory = new Map<string, Map<string, number>>();

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {
    this.logger.log(
      this.redis ? 'Leaderboard backend: Redis' : 'Leaderboard backend: in-memory',
    );
  }

  private key(contestId: string): string {
    return `leaderboard:${contestId}`;
  }

  /** Atomically add `delta` to a user's score and return the new total. */
  async addScore(contestId: string, userId: string, delta: number): Promise<number> {
    if (this.redis) {
      const total = await this.redis.zincrby(this.key(contestId), delta, userId);
      return Number(total);
    }
    const board = this.memory.get(contestId) ?? new Map<string, number>();
    const next = (board.get(userId) ?? 0) + delta;
    board.set(userId, next);
    this.memory.set(contestId, board);
    return next;
  }

  /** Top N entries, highest score first, with 1-based ranks. */
  async getTopN(contestId: string, n = 10): Promise<LeaderboardEntry[]> {
    if (this.redis) {
      const raw = await this.redis.zrevrange(
        this.key(contestId),
        0,
        n - 1,
        'WITHSCORES',
      );
      const entries: LeaderboardEntry[] = [];
      for (let i = 0; i < raw.length; i += 2) {
        entries.push({
          userId: raw[i],
          score: Number(raw[i + 1]),
          rank: i / 2 + 1,
        });
      }
      return entries;
    }
    const board = this.memory.get(contestId) ?? new Map<string, number>();
    return [...board.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([userId, score], idx) => ({ userId, score, rank: idx + 1 }));
  }

  /** Full ranked snapshot, used when syncing final scores to Mongo. */
  async getAll(contestId: string): Promise<LeaderboardEntry[]> {
    if (this.redis) {
      return this.getTopN(contestId, Number.MAX_SAFE_INTEGER);
    }
    const board = this.memory.get(contestId) ?? new Map<string, number>();
    return [...board.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([userId, score], idx) => ({ userId, score, rank: idx + 1 }));
  }

  /** Remove the leaderboard once its final scores have been persisted. */
  async clear(contestId: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(this.key(contestId));
      return;
    }
    this.memory.delete(contestId);
  }
}
