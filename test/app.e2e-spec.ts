import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../src/app.controller';

describe('AppController (health)', () => {
  let controller: AppController;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();
    controller = moduleRef.get(AppController);
  });

  it('returns ok status', () => {
    const res = controller.health();
    expect(res.status).toBe('ok');
    expect(res.service).toBe('interview-hub');
  });
});
