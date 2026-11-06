import { UnauthorizedException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SESSION_IDLE_MS, SessionsService } from './sessions.service';

const USER_ID = new Types.ObjectId();

/** A model stub: findOneAndUpdate finds `current`, findOne finds `replaced`. */
function setup(found: {
  current?: object | null;
  replaced?: { rotatedAt: Date } | null;
}) {
  const exec = <T>(value: T) => ({ exec: () => Promise.resolve(value) });
  const model = {
    create: jest.fn(() => Promise.resolve({})),
    findOneAndUpdate: jest.fn(() => exec(found.current ?? null)),
    findOne: jest.fn(() =>
      exec(found.replaced ? { userId: USER_ID, ...found.replaced } : null),
    ),
    deleteOne: jest.fn(() => exec({})),
    deleteMany: jest.fn(() => exec({})),
  };
  return { service: new SessionsService(model as never), model };
}

describe('SessionsService', () => {
  it('stores only a hash of the refresh token', async () => {
    const { service, model } = setup({});
    const token = await service.create(USER_ID.toString());
    const [doc] = model.create.mock.calls[0] as unknown as [
      { tokenHash: string; expiresAt: Date },
    ];
    expect(doc.tokenHash).toHaveLength(64);
    expect(doc.tokenHash).not.toContain(token);
    expect(doc.expiresAt.getTime()).toBeGreaterThan(
      Date.now() + SESSION_IDLE_MS - 1000,
    );
  });

  it('rotates a current token into a new one', async () => {
    const { service, model } = setup({ current: { userId: USER_ID } });
    const result = await service.rotate('old-token');
    expect(result.userId).toBe(USER_ID.toString());
    expect(result.token).not.toBe('old-token');
    expect(model.deleteMany).not.toHaveBeenCalled();
  });

  it('ends every session when a replaced token is reused', async () => {
    const { service, model } = setup({
      replaced: { rotatedAt: new Date(Date.now() - 60_000) },
    });
    await expect(service.rotate('stolen')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(model.deleteMany).toHaveBeenCalledWith({ userId: USER_ID });
  });

  it('does not treat two tabs refreshing together as theft', async () => {
    const { service, model } = setup({
      replaced: { rotatedAt: new Date(Date.now() - 2_000) },
    });
    await expect(service.rotate('raced')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(model.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects an unknown or expired token without ending anything', async () => {
    const { service, model } = setup({});
    await expect(service.rotate('unknown')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(model.deleteMany).not.toHaveBeenCalled();
  });
});
