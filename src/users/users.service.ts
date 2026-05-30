//@ts-nocheck

import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

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
      if (existing.email === data.email)
        throw new ConflictException('Email already registered');
      throw new ConflictException('Username already taken');
    }
    const user = new this.userModel(data);
    return user.save();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  // Approach 1: Base64
  // The file buffer (raw bytes) that Multer read into memory is converted
  // to a Base64 string and stored directly in the MongoDB document.
  //
  // file.buffer  → raw bytes of the image (Uint8Array)
  // .toString('base64') → converts bytes to Base64 encoded string
  // We prefix with "data:image/jpeg;base64," so browsers can render it
  // directly in an <img src="..."> tag without any extra work
  async uploadAvatarBase64(
    userId: string,
    file: Express.Multer.File,
  ): Promise<UserDocument> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Convert raw buffer to Base64 data URI
    // This entire string goes into MongoDB as the avatarBase64 field
    const base64String = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    const updated = await this.userModel.findByIdAndUpdate(
      userId,
      { avatarBase64: base64String },
      { new: true },
    );

    return updated!;
  }

  // Approach 2: Disk path
  // Multer has already written the file to disk before this method runs.
  // We just need to:
  //   1. Delete the old file if one existed (avoid orphaned files)
  //   2. Store the new file's URL path in MongoDB
  //
  // file.filename → the unique name Multer generated (e.g. "1716900000-alice.jpg")
  // file.path     → the full filesystem path where Multer saved it
  async uploadAvatarDisk(
    userId: string,
    file: Express.Multer.File,
  ): Promise<UserDocument> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Clean up old file from disk before saving the new reference
    if (user.avatarUrl) {
      const oldPath = path.join(process.cwd(), user.avatarUrl);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath); // synchronously delete the file
      }
    }

    // Build the public URL — this is what gets stored in MongoDB
    // and what the browser uses to fetch the image
    const avatarUrl = `/uploads/avatars/${file.filename}`;

    const updated = await this.userModel.findByIdAndUpdate(
      userId,
      { avatarUrl },
      { new: true },
    );

    return updated!;
  }

  // Returns public profile — strips passwordHash, includes both avatar fields
  async getProfile(userId: string): Promise<object> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    return {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,       // disk path approach
      avatarBase64: user.avatarBase64, // base64 approach
      createdAt: (user as any).createdAt,
    };
  }
}