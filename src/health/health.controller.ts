import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService } from './health.service';

/**
 * Probes for the load balancer and container runtime. Public, never rate
 * limited, and they name failing components without any error detail.
 */
@SkipThrottle({ default: true, hourly: true })
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** The process is up. A failure here means restart it. */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /** Dependencies answer. A failure here means stop sending it traffic. */
  @Get(['', 'ready'])
  async ready() {
    const { ready, checks } = await this.health.readiness();
    if (!ready) {
      const down = Object.entries(checks)
        .filter(([, status]) => status === 'down')
        .map(([name]) => `${name}: down`);
      throw new ServiceUnavailableException(down.join(', '));
    }
    return { status: 'ok', checks };
  }
}
