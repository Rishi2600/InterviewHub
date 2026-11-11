import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';
import { Session, SessionDocument } from './schemas/session.schema';

const DAY = 24 * 60 * 60 * 1000;
/** A session ends after this long without a refresh. */
export const SESSION_IDLE_MS = 30 * DAY;
/** And this long after sign-in, however often it is refreshed. */
export const SESSION_MAX_MS = 90 * DAY;
/** Two tabs refreshing at once is not theft; reuse this soon is ignored. */
const REUSE_GRACE_MS = 10 * 1000;

export interface ClientInfo {
  userAgent?: string | null;
  ip?: string | null;
}

const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
  ) {}

  /** Starts a session and returns its refresh token. */
  async create(userId: string, client: ClientInfo = {}): Promise<string> {
    const token = newToken();
    const now = Date.now();
    await this.sessionModel.create({
      userId: new Types.ObjectId(userId),
      tokenHash: hash(token),
      expiresAt: new Date(now + SESSION_IDLE_MS),
      lastUsedAt: new Date(now),
      ...clean(client),
    });
    return token;
  }

  /**
   * Swaps a refresh token for a new one. The old token stops working at once.
   * Presenting a token that was already swapped ends every session of that
   * user, since someone else must hold a copy.
   */
  async rotate(
    token: string,
    client: ClientInfo = {},
  ): Promise<{ userId: string; token: string }> {
    const oldHash = hash(token);
    const next = newToken();
    const now = Date.now();

    const session = await this.sessionModel
      .findOneAndUpdate(
        {
          tokenHash: oldHash,
          expiresAt: { $gt: new Date(now) },
          createdAt: { $gt: new Date(now - SESSION_MAX_MS) },
        },
        {
          $set: {
            tokenHash: hash(next),
            previousHash: oldHash,
            rotatedAt: new Date(now),
            lastUsedAt: new Date(now),
            expiresAt: new Date(now + SESSION_IDLE_MS),
            ...clean(client),
          },
        },
        { returnDocument: 'after' },
      )
      .exec();
    if (session) return { userId: session.userId.toString(), token: next };

    const replaced = await this.sessionModel
      .findOne({ previousHash: oldHash })
      .exec();
    const rotatedAt = replaced?.rotatedAt?.getTime() ?? 0;
    if (replaced && now - rotatedAt > REUSE_GRACE_MS) {
      await this.revokeAll(replaced.userId.toString());
    }
    throw new UnauthorizedException('Session expired');
  }

  /** Ends the session this refresh token belongs to, if any. */
  async revoke(token: string): Promise<void> {
    await this.sessionModel.deleteOne({ tokenHash: hash(token) }).exec();
  }

  /** Ends every session of a user. */
  async revokeAll(userId: string): Promise<void> {
    await this.sessionModel
      .deleteMany({ userId: new Types.ObjectId(userId) })
      .exec();
  }
}

/** Keeps request headers from bloating the collection. */
function clean(client: ClientInfo) {
  return {
    userAgent: client.userAgent?.slice(0, 256) ?? null,
    ip: client.ip ?? null,
  };
}
