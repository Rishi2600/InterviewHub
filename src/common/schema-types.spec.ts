import { Schema } from 'mongoose';
import { ContestEntrySchema } from '../contests/schemas/contest-entry.schema';
import { ContestSchema } from '../contests/schemas/contest.schema';
import { RoomSchema } from '../rooms/schemas/room.schema';
import { MessageSchema } from '../chat/schemas/message.schema';

// @nestjs/mongoose 12 turns `type: Types.ObjectId` into Mixed, which silently
// stops casting string ids in queries. Every id reference must stay ObjectId.
const idPaths: [string, Schema, string][] = [
  ['ContestEntry', ContestEntrySchema, 'contestId'],
  ['ContestEntry', ContestEntrySchema, 'userId'],
  ['Contest', ContestSchema, 'ownerId'],
  ['Room', RoomSchema, 'ownerId'],
  ['Room', RoomSchema, 'participants.userId'],
  ['Message', MessageSchema, 'roomId'],
  ['Message', MessageSchema, 'senderId'],
];

describe('schema id references', () => {
  it.each(idPaths)('%s.%s is an ObjectId path', (_, schema, path) => {
    expect(schema.path(path)?.instance).toBe('ObjectId');
  });
});
