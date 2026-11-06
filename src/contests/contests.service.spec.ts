import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ContestsService } from './contests.service';
import { ContestStatus } from './schemas/contest.schema';

const CONTEST_ID = new Types.ObjectId().toString();
const HOST_ID = new Types.ObjectId().toString();
const OTHER_ID = new Types.ObjectId().toString();

/** A ContestsService whose contest model returns one stub contest. */
function serviceWithContest(status: ContestStatus) {
  const contest = { status, hostId: new Types.ObjectId(HOST_ID) };
  const contestModel = {
    findById: () => ({ exec: () => Promise.resolve(contest) }),
  };
  return new ContestsService(contestModel as never, {} as never);
}

describe('ContestsService.findVisible', () => {
  const host = { userId: HOST_ID, role: 'interviewer' };
  const other = { userId: OTHER_ID, role: 'candidate' };
  const admin = { userId: OTHER_ID, role: 'admin' };

  it('shows a draft to its host and admins only', async () => {
    const service = serviceWithContest('draft');
    await expect(service.findVisible(CONTEST_ID, host)).resolves.toBeTruthy();
    await expect(service.findVisible(CONTEST_ID, admin)).resolves.toBeTruthy();
    await expect(service.findVisible(CONTEST_ID, other)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('shows published and cancelled contests to any signed-in user', async () => {
    for (const status of ['published', 'cancelled'] as const) {
      const service = serviceWithContest(status);
      await expect(
        service.findVisible(CONTEST_ID, other),
      ).resolves.toBeTruthy();
    }
  });

  it('answers 404 for a malformed id', async () => {
    const service = serviceWithContest('published');
    await expect(service.findVisible('not-an-id', other)).rejects.toThrow(
      NotFoundException,
    );
  });
});
