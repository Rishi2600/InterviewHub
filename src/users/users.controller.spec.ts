import { Types } from 'mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const ID = new Types.ObjectId();
const user = {
  _id: ID,
  username: 'priya',
  email: 'priya@example.com',
  role: 'candidate',
  avatarUrl: null,
};

describe('UsersController.getById', () => {
  const service = new UsersService({
    findById: () => ({ exec: () => Promise.resolve(user) }),
  } as never);
  const controller = new UsersController(service, {} as never);
  const viewer = (userId: string, role = 'candidate') => ({
    userId,
    role,
    username: 'viewer',
    email: 'viewer@example.com',
  });

  it('hides the email from other users', async () => {
    const seen = await controller.getById(
      ID.toString(),
      viewer(new Types.ObjectId().toString()),
    );
    expect(seen).not.toHaveProperty('email');
    expect(seen).toMatchObject({ id: ID.toString(), username: 'priya' });
  });

  it('shows the email to the user themselves and to admins', async () => {
    const self = await controller.getById(ID.toString(), viewer(ID.toString()));
    const admin = await controller.getById(
      ID.toString(),
      viewer(new Types.ObjectId().toString(), 'admin'),
    );
    expect(self).toHaveProperty('email', 'priya@example.com');
    expect(admin).toHaveProperty('email', 'priya@example.com');
  });
});
