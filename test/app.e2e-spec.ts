import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../src/health/health.controller';
import { HealthService } from '../src/health/health.service';

describe('HealthController (liveness)', () => {
  let controller: HealthController;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: {} }],
    }).compile();
    controller = moduleRef.get(HealthController);
  });

  it('reports the process as live', () => {
    expect(controller.live()).toEqual({ status: 'ok' });
  });
});
