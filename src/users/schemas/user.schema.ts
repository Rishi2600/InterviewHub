import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from '../../common/enums/role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, trim: true })
  username: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({
    type: String,
    enum: Object.values(Role),
    default: Role.Candidate,
  })
  role: Role;

  @Prop({ type: String, default: null })
  avatarUrl: string | null;

  // Kept for the Base64 learning contrast endpoint. Marked for removal (roadmap C1).
  @Prop({ type: String, default: null })
  avatarBase64: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
