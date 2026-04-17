import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true }) // adds createdAt and updatedAt automatically
export class User {
  @Prop({ required: true, unique: true, trim: true })
  username: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  // We store the hash, never the raw password
  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, enum: ['candidate', 'interviewer'] })
  role: string;
}

export const UserSchema = SchemaFactory.createForClass(User);