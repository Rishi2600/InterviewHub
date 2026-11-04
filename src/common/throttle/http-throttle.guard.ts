import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Global HTTP rate limit, counted per client IP (`req.ip`, which honours
 * TRUST_PROXY). Socket events are left to WsThrottleGuard.
 */
@Injectable()
export class HttpThrottleGuard extends ThrottlerGuard {
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    return Promise.resolve(context.getType() !== 'http');
  }
}
