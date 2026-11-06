import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FinalizeService } from './finalize.service';

/**
 * The trigger only: every minute, on every server. The work and all its
 * safety live in FinalizeService, which tests call directly with their own
 * clock. waitForCompletion skips a tick while the last run is still going,
 * and makes shutdown wait for it.
 */
@Injectable()
export class FinalizeJob {
  constructor(private readonly finalize: FinalizeService) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'contest-finalize',
    waitForCompletion: true,
  })
  async run(): Promise<void> {
    await this.finalize.finalizeDue(new Date());
  }
}
