import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from '../common/enums/role.enum';
import { User, UserDocument } from './schemas/user.schema';

/**
 * The single owner of the `users` collection. No other module queries users
 * directly; they go through this service.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(input: {
    username: string;
    email: string;
    passwordHash: string;
    role?: Role;
  }): Promise<UserDocument> {
    const existing = await this.userModel
      .findOne({ email: input.email.toLowerCase() })
      .exec();
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const created = new this.userModel(input);
    return created.save();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async setAvatarUrl(id: string, avatarUrl: string): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(id, { avatarUrl }, { new: true })
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Strips the password hash before returning a user to a client. */
  toSafe(user: UserDocument) {
    return {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };
  }
}
