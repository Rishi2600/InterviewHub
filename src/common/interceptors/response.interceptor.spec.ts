import { ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

const run = (type: string, value: unknown) =>
  lastValueFrom(
    new ResponseInterceptor().intercept(
      { getType: () => type } as unknown as ExecutionContext,
      { handle: () => of(value) },
    ),
  );

describe('ResponseInterceptor', () => {
  it('wraps HTTP responses in the envelope', async () => {
    await expect(run('http', { id: 1 })).resolves.toMatchObject({
      success: true,
      data: { id: 1 },
    });
  });

  it('leaves socket acks as returned', async () => {
    const ack = { ok: true, pinnedQuestion: 'Q1' };
    await expect(run('ws', ack)).resolves.toBe(ack);
  });
});
