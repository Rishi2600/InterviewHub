import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PracticeService } from './practice.service';

/**
 * Every minute, on every server: ends interviews whose time is up and
 * writes feedback that is due. Leases in the services keep two servers from
 * doing the same one. Tests call PracticeService.sweep with their own clock.
 */
@Injectable()
export class PracticeJob {
  constructor(private readonly practice: PracticeService) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'practice-sweep',
    waitForCompletion: true,
  })
  async run(): Promise<void> {
    await this.practice.sweep(new Date());
  }
}
