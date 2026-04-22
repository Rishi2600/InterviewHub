import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  // @InjectModel(User.name) is how Mongoose DI works in NestJS
  // User.name resolves to the string "User" — the collection name Mongoose derives from it
  // This gives us the full Mongoose Model with .find(), .findOne(), .create() etc.
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  // Used by AuthService during registration
  // Throws ConflictException if email or username already exists
  // MongoDB will also enforce this via the unique index on the schema,
  // but catching it here lets us return a clean 409 instead of a raw Mongo error
  async create(data: {
    username: string;
    email: string;
    passwordHash: string;
    role: string;
  }): Promise<UserDocument> {
    const existing = await this.userModel.findOne({
      $or: [{ email: data.email }, { username: data.username }],
    });

    if (existing) {
      // Tell the user specifically what's taken
      if (existing.email === data.email) {
        throw new ConflictException('Email already registered');
      }
      throw new ConflictException('Username already taken');
    }

    const user = new this.userModel(data);
    return user.save(); // Mongoose validates against schema then writes to MongoDB
  }

  // Used by JwtStrategy on every protected request to rehydrate the user
  // _id in MongoDB is an ObjectId — Mongoose accepts both string and ObjectId here
  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  // Used by AuthService during login to find who's trying to log in
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }
}