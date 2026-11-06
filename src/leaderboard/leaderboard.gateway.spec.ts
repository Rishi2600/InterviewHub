import { Types } from 'mongoose';
import { Socket } from 'socket.io';
import { LeaderboardGateway } from './leaderboard.gateway';
import { AuthUser } from '../common/decorators/current-user.decorator';

const CONTEST_ID = new Types.ObjectId().toString();
const OWNER_ID = new Types.ObjectId().toString();
const ENTRANT_ID = new Types.ObjectId().toString();

const user = (userId: string, role = 'candidate'): AuthUser => ({
  userId,
  username: userId,
  email: `${userId}@example.com`,
  role,
});

/**
 * Fake models that answer `exists` from a tiny in-memory contest. Like a real
 * ObjectId path, a filter only matches an ObjectId, not a plain string.
 */
function buildGateway() {
  const matches = (q: Record<string, unknown>, doc: Record<string, string>) =>
    Object.entries(q).every(
      ([k, v]) => v instanceof Types.ObjectId && v.toString() === doc[k],
    );
  const contest = { _id: CONTEST_ID, hostId: OWNER_ID };
  const entry = { contestId: CONTEST_ID, userId: ENTRANT_ID };
  const contestModel = {
    exists: (q: Record<string, unknown>) =>
      Promise.resolve(matches(q, contest)),
  };
  const entryModel = {
    exists: (q: Record<string, unknown>) => Promise.resolve(matches(q, entry)),
  };
  const getTopN = jest.fn().mockResolvedValue([]);

  const gateway = new LeaderboardGateway(
    { getTopN } as never,
    contestModel as never,
    entryModel as never,
    {} as never,
  );
  const join = jest.fn();
  const emit = jest.fn();
  const client = { join, emit } as unknown as Socket;
  return { gateway, client, join, emit };
}

describe('LeaderboardGateway subscribe authorization', () => {
  it.each([
    ['owner', user(OWNER_ID, 'interviewer')],
    ['entrant', user(ENTRANT_ID)],
    ['admin', user(new Types.ObjectId().toString(), 'admin')],
  ])('lets the %s subscribe and sends the current board', async (_, u) => {
    const { gateway, client, join, emit } = buildGateway();
    await expect(
      gateway.onJoin(client, { contestId: CONTEST_ID }, u),
    ).resolves.toEqual({ ok: true });
    expect(join).toHaveBeenCalledWith(`contest:${CONTEST_ID}`);
    expect(emit).toHaveBeenCalledWith('leaderboard:update', {
      contestId: CONTEST_ID,
      top: [],
    });
  });

  it('rejects a user who has not joined the contest', async () => {
    const { gateway, client, join, emit } = buildGateway();
    await expect(
      gateway.onJoin(
        client,
        { contestId: CONTEST_ID },
        user(new Types.ObjectId().toString()),
      ),
    ).rejects.toThrow('You are not part of this contest');
    expect(join).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('gives a missing contest the same error, even for an admin', async () => {
    const { gateway, client } = buildGateway();
    const admin = user(new Types.ObjectId().toString(), 'admin');
    await expect(
      gateway.onJoin(client, { contestId: 'not-an-id' }, admin),
    ).rejects.toThrow('You are not part of this contest');
    await expect(
      gateway.onJoin(
        client,
        { contestId: new Types.ObjectId().toString() },
        admin,
      ),
    ).rejects.toThrow('You are not part of this contest');
  });
});
