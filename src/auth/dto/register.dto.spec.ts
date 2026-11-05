import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

const base = { username: 'sam', email: 'sam@example.com', password: 'secret1' };

async function errorsFor(role?: string) {
  const dto = plainToInstance(RegisterDto, { ...base, role });
  return validate(dto);
}

describe('RegisterDto role', () => {
  it('accepts no role, candidate and interviewer', async () => {
    expect(await errorsFor()).toHaveLength(0);
    expect(await errorsFor('candidate')).toHaveLength(0);
    expect(await errorsFor('interviewer')).toHaveLength(0);
  });

  it('rejects admin and unknown roles', async () => {
    expect((await errorsFor('admin'))[0].property).toBe('role');
    expect((await errorsFor('owner'))[0].property).toBe('role');
  });
});
