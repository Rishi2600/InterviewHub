import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ContestEntrantService } from './contest-entrant.service';

const HOST_ID = new Types.ObjectId().toString();

describe('ContestEntrantService.join', () => {
  it('stops the host entering their own contest', async () => {
    const contests = {
      findVisible: () =>
        Promise.resolve({
          status: 'published',
          hostId: new Types.ObjectId(HOST_ID),
        }),
    };
    const service = new ContestEntrantService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      contests as never,
      {} as never,
    );
    await expect(
      service.join(new Types.ObjectId().toString(), {
        userId: HOST_ID,
        username: 'host',
        role: 'interviewer',
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
