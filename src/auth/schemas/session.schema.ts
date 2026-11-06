import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type SessionDocument = HydratedDocument<Session>;

/**
 * One signed-in device. Holds only hashes of refresh tokens, never the tokens.
 * Rules: docs/AUTH_DESIGN.md.
 */
@Schema({
  collection: 'sessions',
  timestamps: { createdAt: true, updatedAt: false },
})
export class Session {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  // The token this one replaced, so reusing it can be caught.
  @Prop({ type: String, default: null, index: true })
  previousHash: string | null;

  @Prop({ type: Date, default: null })
  rotatedAt: Date | null;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Date, required: true })
  lastUsedAt: Date;

  @Prop({ type: String, default: null })
  userAgent: string | null;

  @Prop({ type: String, default: null })
  ip: string | null;

  createdAt: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
// Mongo deletes a session once expiresAt passes.
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
