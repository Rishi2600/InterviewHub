import {
  BadRequestException,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function render(exception: unknown) {
  const json = jest.fn();
  const res = { status: jest.fn(() => ({ json })) };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ url: '/x' }),
    }),
  };
  new AllExceptionsFilter().catch(exception, host as never);
  return json.mock.calls[0][0] as { statusCode: number; error: string };
}

describe('AllExceptionsFilter', () => {
  it('names the status of an exception that carries only a message', () => {
    const body = render(
      new PayloadTooLargeException('request entity too large'),
    );
    expect(body).toMatchObject({ statusCode: 413, error: 'Payload Too Large' });
  });

  it('keeps the error name an exception gives', () => {
    expect(render(new BadRequestException(['bad'])).error).toBe('Bad Request');
  });

  it('hides unexpected errors behind a 500', () => {
    const body = render(new Error('db password is hunter2'));
    expect(body).toMatchObject({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'InternalServerError',
    });
  });
});
