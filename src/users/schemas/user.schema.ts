//@ts-nocheck

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, trim: true })
  username: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, enum: ['candidate', 'interviewer'] })
  role: string;

  // Approach 1 — Base64
  // The entire image is stored as a data URI string directly in this field
  // e.g. "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  // Stored in MongoDB, retrieved with the user document
  @Prop({ type: String, default: null })
  avatarBase64: string | null;

  // Approach 2 — Disk path
  // Only the relative URL path is stored here
  // e.g. "/uploads/avatars/1716900000-alice.jpg"
  // The actual file lives on disk, served as a static asset
  @Prop({ type: String, default: null })
  avatarUrl: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);