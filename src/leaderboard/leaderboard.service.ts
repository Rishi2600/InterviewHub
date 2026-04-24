//@ts-nocheck

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  rank: number;
}

@Injectable()
export class LeaderboardService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;

  constructor(private config: ConfigService) {}

  // OnModuleInit runs after the module is fully initialized
  // We create a dedicated Redis client for leaderboard operations
  // separate from the Socket.io pub/sub clients in main.ts
  async onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL') as string;

    this.client = createClient({
      url: redisUrl,
      socket: {
        tls: redisUrl.startsWith('rediss://'),
        rejectUnauthorized: false,
      },
    }) as RedisClientType;

    this.client.on('error', (err) =>
      console.error('Leaderboard Redis error:', err),
    );

    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.disconnect();
  }

  // Redis key pattern: leaderboard:{contestId}
  // Each contest gets its own sorted set
  private key(contestId: string): string {
    return `leaderboard:${contestId}`;
  }

  // ZADD key score member — adds or updates a user's score
  // We store userId as the member and score as the value
  // But we also need the username for display — stored separately
  async addScore(
    contestId: string,
    userId: string,
    username: string,
    points: number,
  ): Promise<number> {
    // ZINCRBY atomically increments the score — safe for concurrent updates
    // Returns the new score as a string, we parse it to number
    const newScore = await this.client.zIncrBy(
      this.key(contestId),
      points,
      userId,
    );

    // Store username in a hash so we can look it up when building the leaderboard
    // Hash key: leaderboard:users:{contestId}, field: userId, value: username
    await this.client.hSet(
      `leaderboard:users:${contestId}`,
      userId,
      username,
    );

    return Number(newScore);
  }

  // ZREVRANGE — returns members sorted by score descending (highest first)
  // topN defaults to 10 — enough for a leaderboard display
  async getTopN(
    contestId: string,
    topN = 10,
  ): Promise<LeaderboardEntry[]> {
    // ZREVRANGE with WITHSCORES returns [ member, score, member, score... ]
    const results = await this.client.zRangeWithScores(
      this.key(contestId),
      0,
      topN - 1,
      { REV: true }, // descending order
    );

    // Fetch all usernames in one Redis call (HMGET)
    const userIds = results.map((r) => r.value);
    const usernames = userIds.length
      ? await this.client.hmGet(`leaderboard:users:${contestId}`, userIds)
      : [];

    // Build the leaderboard array with rank
    return results.map((result, index) => ({
      userId: result.value,
      username: usernames[index] ?? result.value,
      score: result.score,
      rank: index + 1,
    }));
  }

  // Returns the full leaderboard — used when syncing to MongoDB on contest end
  async getAll(contestId: string): Promise<LeaderboardEntry[]> {
    const results = await this.client.zRangeWithScores(
      this.key(contestId),
      0,
      -1, // -1 means all members
      { REV: true },
    );

    const userIds = results.map((r) => r.value);
    const usernames = userIds.length
      ? await this.client.hmGet(`leaderboard:users:${contestId}`, userIds)
      : [];

    return results.map((result, index) => ({
      userId: result.value,
      username: usernames[index] ?? result.value,
      score: result.score,
      rank: index + 1,
    }));
  }

  // Called after contest ends — cleans up Redis keys
  async clearContest(contestId: string): Promise<void> {
    await this.client.del(this.key(contestId));
    await this.client.del(`leaderboard:users:${contestId}`);
  }
}