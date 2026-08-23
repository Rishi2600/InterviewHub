import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ContestsService } from './contests.service';
import { ContestState } from './schemas/contest.schema';

const CONTEST_ID = new Types.ObjectId().toString();
const OWNER_ID = new Types.ObjectId().toString();
const OTHER_ID = new Types.ObjectId().toString();

interface StubContest {
  state: ContestState;
  endedAt: Date | null;
  ownerId: Types.ObjectId;
  save: jest.Mock;
}

/** A ContestsService whose contest model returns one stub contest document. */
function serviceWithContest(state: ContestState): {
  service: ContestsService;
  contest: StubContest;
} {
  const contest: StubContest = {
    state,
    endedAt: null,
    ownerId: new Types.ObjectId(OWNER_ID),
    save: jest.fn(() => Promise.resolve(contest)),
  };
  const contestModel = {
    findById: () => ({ exec: () => Promise.resolve(contest) }),
  };
  const entryModel = {};
  const leaderboardService = {};
  const leaderboardGateway = {};

  const service = new ContestsService(
    contestModel as never,
    entryModel as never,
    leaderboardService as never,
    leaderboardGateway as never,
  );
  return { service, contest };
}

describe('ContestsService state machine', () => {
  it('allows draft -> active for the owner', async () => {
    const { service, contest } = serviceWithContest('draft');
    await service.setState(CONTEST_ID, OWNER_ID, 'interviewer', 'active');
    expect(contest.state).toBe('active');
    expect(contest.save).toHaveBeenCalledTimes(1);
  });

  it('allows active -> ended and stamps endedAt', async () => {
    const { service, contest } = serviceWithContest('active');
    await service.setState(CONTEST_ID, OWNER_ID, 'interviewer', 'ended');
    expect(contest.state).toBe('ended');
    expect(contest.endedAt).toBeInstanceOf(Date);
  });

  describe('rejected transitions', () => {
    it.each<[ContestState, ContestState]>([
      ['draft', 'ended'],
      ['active', 'draft'],
      ['ended', 'draft'],
      ['ended', 'active'],
    ])('rejects %s -> %s', async (from, to) => {
      const { service, contest } = serviceWithContest(from);
      await expect(
        service.setState(CONTEST_ID, OWNER_ID, 'interviewer', to),
      ).rejects.toThrow(BadRequestException);
      expect(contest.state).toBe(from);
      expect(contest.save).not.toHaveBeenCalled();
    });
  });

  it('does not stamp endedAt on a no-op ended -> ended', async () => {
    const { service, contest } = serviceWithContest('ended');
    await service.setState(CONTEST_ID, OWNER_ID, 'interviewer', 'ended');
    expect(contest.state).toBe('ended');
  });
});

describe('ContestsService ownership', () => {
  it('rejects a non-owner attempting a transition', async () => {
    const { service, contest } = serviceWithContest('draft');
    await expect(
      service.setState(CONTEST_ID, OTHER_ID, 'interviewer', 'active'),
    ).rejects.toThrow(ForbiddenException);
    expect(contest.save).not.toHaveBeenCalled();
  });

  it('lets an admin transition a contest they do not own', async () => {
    const { service, contest } = serviceWithContest('draft');
    await service.setState(CONTEST_ID, OTHER_ID, 'admin', 'active');
    expect(contest.state).toBe('active');
  });

  it('checks ownership before validating the transition', async () => {
    // A non-owner asking for an invalid transition should still be told it is
    // a permission problem, not leak that the transition was impossible.
    const { service } = serviceWithContest('ended');
    await expect(
      service.setState(CONTEST_ID, OTHER_ID, 'interviewer', 'active'),
    ).rejects.toThrow(ForbiddenException);
  });
});
