// Adds test data to the local dev database: users, contests in every state,
// rooms with chat, and real results and scores. Data from earlier runs of
// this script is replaced; everything else is left alone.
// Usage: npm run db:seed
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/schemas/user.schema';
import { Session } from '../src/auth/schemas/session.schema';
import { Room } from '../src/rooms/schemas/room.schema';
import { Message } from '../src/chat/schemas/message.schema';
import { Contest } from '../src/contests/schemas/contest.schema';
import { ContestQuestion } from '../src/contests/schemas/contest-question.schema';
import { ContestEntry } from '../src/contests/schemas/contest-entry.schema';
import { HostUsage } from '../src/contests/schemas/host-usage.schema';
import { ActivityEvent } from '../src/activity/schemas/activity-event.schema';
import { UserScore } from '../src/score/schemas/user-score.schema';
import { RoomsService } from '../src/rooms/rooms.service';
import { FinalizeService } from '../src/contests/finalize/finalize.service';
import { ScoreService } from '../src/score/score.service';
import { usageMonth } from '../src/contests/contest-hosting.service';
import { localMongoUri } from './safety';
import {
  CONTESTS,
  ROOMS,
  SEED_DOMAIN,
  SEED_PASSWORD,
  SeedContest,
  SeedQuestion,
  USERS,
} from './seed-data';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Fixed-seed random numbers, so every run makes the same answers.
let state = 42;
function rnd(): number {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const optionId = (i: number) => String.fromCharCode(97 + i);
const at = (ms: number) => new Date(ms);
const onTheHour = (ms: number) => Math.ceil(ms / HOUR) * HOUR;

type Models = ReturnType<typeof models>;
function models(app: { get: (token: string, o: object) => unknown }) {
  const m = <T>(name: string) =>
    app.get(getModelToken(name), { strict: false }) as Model<T>;
  return {
    user: m<User>(User.name),
    session: m<Session>(Session.name),
    room: m<Room>(Room.name),
    message: m<Message>(Message.name),
    contest: m<Contest>(Contest.name),
    question: m<ContestQuestion>(ContestQuestion.name),
    entry: m<ContestEntry>(ContestEntry.name),
    usage: m<HostUsage>(HostUsage.name),
    event: m<ActivityEvent>(ActivityEvent.name),
    score: m<UserScore>(UserScore.name),
  };
}

/** Deletes what an earlier run made. Returns other users whose scores
 *  included seeded contests, so they can be recomputed. */
async function removePrevious(db: Models): Promise<Types.ObjectId[]> {
  const domain = SEED_DOMAIN.replace(/\./g, '\\.');
  const users = await db.user.find({ email: new RegExp(`@${domain}$`) });
  const ids = users.map((u) => u._id);
  const contestIds = (await db.contest.distinct('_id', {
    hostId: { $in: ids },
  })) as Types.ObjectId[];
  const others: Types.ObjectId[] = await db.entry.distinct('userId', {
    contestId: { $in: contestIds },
    userId: { $nin: ids },
  });
  const rooms = (await db.room.distinct('_id', {
    ownerId: { $in: ids },
  })) as Types.ObjectId[];

  await db.question.deleteMany({ contestId: { $in: contestIds } });
  await db.entry.deleteMany({
    $or: [{ contestId: { $in: contestIds } }, { userId: { $in: ids } }],
  });
  await db.event.deleteMany({
    $or: [{ refId: { $in: contestIds } }, { userId: { $in: ids } }],
  });
  await db.contest.deleteMany({ _id: { $in: contestIds } });
  await db.usage.deleteMany({ hostId: { $in: ids } });
  await db.score.deleteMany({ userId: { $in: ids } });
  await db.message.deleteMany({
    $or: [{ roomId: { $in: rooms } }, { senderId: { $in: ids } }],
  });
  await db.room.deleteMany({ _id: { $in: rooms } });
  await db.room.updateMany(
    {},
    { $pull: { participants: { userId: { $in: ids } } } },
  );
  await db.session.deleteMany({ userId: { $in: ids } });
  await db.user.deleteMany({ _id: { $in: ids } });
  return others;
}

/** The options a candidate picks: right with their skill as the chance,
 *  otherwise a wrong one or, on multi-answer questions, only some. */
function pick(q: SeedQuestion, skill: number): string[] {
  if (rnd() < skill) return q.correct.map(optionId);
  if (q.correct.length > 1 && rnd() < 0.5) {
    return q.correct.slice(0, -1).map(optionId);
  }
  const wrong = q.options
    .map((_, i) => i)
    .filter((i) => !q.correct.includes(i));
  return [optionId(wrong[Math.floor(rnd() * wrong.length)])];
}

interface Entrant {
  key: string;
  joinedAt: number;
  // How far they got: joined only, answering, or handed in.
  progress: 'joined' | 'started' | 'submitted';
  // Answer at most this many questions (all by default).
  answerUpTo?: number;
}

function timesFor(c: SeedContest, now: number) {
  const t = c.timing;
  const start =
    t.kind === 'ended'
      ? Math.floor((now - t.daysAgo * DAY) / DAY) * DAY + 14 * HOUR
      : t.kind === 'live'
        ? Math.floor((now - 30 * MIN) / MIN) * MIN
        : t.kind === 'upcoming'
          ? onTheHour(now + t.daysAhead * DAY)
          : onTheHour(now + 3 * DAY);
  return { start, end: start + c.durationMinutes * MIN };
}

/** Who takes part in a contest, by its state. */
function entrantsFor(c: SeedContest, start: number, now: number): Entrant[] {
  const candidates = USERS.filter((u) => u.role === 'candidate');
  const t = c.timing;
  if (t.kind === 'ended') {
    // Everyone but one or two, and one who joins but never starts: over the
    // ten starters a contest needs to be rated.
    const skip = new Set([Math.floor(rnd() * 14), Math.floor(rnd() * 14)]);
    const flake = Math.floor(rnd() * 14);
    return candidates
      .filter((_, i) => !skip.has(i))
      .map((u, i) => ({
        key: u.key,
        joinedAt: start - (1 + rnd() * 48) * HOUR,
        progress: i === flake ? 'joined' : 'submitted',
      }));
  }
  const join = (keys: string[], progress: Entrant['progress'], upTo?: number) =>
    keys.map((key) => ({
      key,
      joinedAt: Math.min(start, now) - (1 + rnd() * 20) * HOUR,
      progress,
      answerUpTo: upTo,
    }));
  if (t.kind === 'live') {
    return [
      ...join(['ada'], 'submitted'),
      ...join(['jonah', 'lena', 'mei'], 'started', 3),
      ...join(['diego', 'nora'], 'joined'),
    ];
  }
  if (t.kind === 'upcoming') {
    return join(
      t.daysAhead <= 1
        ? ['ada', 'jonah', 'rohan', 'zara', 'leo']
        : ['lena', 'theo', 'iris'],
      'joined',
    );
  }
  return [];
}

async function seedContest(
  db: Models,
  c: SeedContest,
  ids: Map<string, Types.ObjectId>,
  now: number,
) {
  const host = USERS.find((u) => u.key === c.host)!;
  const { start, end } = timesFor(c, now);
  const status =
    c.timing.kind === 'draft'
      ? 'draft'
      : c.timing.kind === 'cancelled'
        ? 'cancelled'
        : 'published';
  const contestId = new Types.ObjectId();
  const questions = c.questions.map((q, order) => ({
    _id: new Types.ObjectId(),
    contestId,
    order,
    kind: q.correct.length > 1 ? 'multiple' : 'single',
    prompt: q.prompt,
    options: q.options.map((text, i) => ({ id: optionId(i), text })),
    correctOptionIds: q.correct.map(optionId),
    points: q.points ?? 1,
    explanation: q.explanation ?? '',
  }));

  // Ended contests are answered in full; a live one only up to now.
  const cutoff = Math.min(end, now);
  const entries = entrantsFor(c, start, now).map((e) => {
    const user = USERS.find((u) => u.key === e.key)!;
    const startedAt = start + rnd() * 5 * MIN;
    const answers: ContestEntry['answers'] = [];
    let t = startedAt;
    if (e.progress !== 'joined') {
      c.questions.slice(0, e.answerUpTo).forEach((q, i) => {
        t += (40 + rnd() * 100) * 1000;
        if (t >= cutoff || rnd() < 0.08) return;
        answers.push({
          questionId: questions[i]._id,
          optionIds: pick(q, user.skill!),
          answeredAt: at(t),
        });
      });
    }
    // In ended contests a few leave it to the clock to hand in.
    const handedIn =
      e.progress === 'submitted' && (c.timing.kind !== 'ended' || rnd() > 0.15);
    return {
      contestId,
      userId: ids.get(e.key)!,
      username: user.username,
      joinedAt: at(e.joinedAt),
      startedAt: e.progress === 'joined' ? null : at(startedAt),
      submittedAt: handedIn ? at(Math.min(t + 20_000, cutoff - 1000)) : null,
      answers,
    };
  });

  await db.contest.create({
    _id: contestId,
    title: c.title,
    description: c.description,
    hostId: ids.get(c.host)!,
    hostName: host.username,
    status,
    startAt: at(start),
    endAt: at(end),
    durationMinutes: c.durationMinutes,
    questionCount: questions.length,
    totalPoints: questions.reduce((sum, q) => sum + q.points, 0),
    entrantCount: entries.length,
    startedCount: entries.filter((e) => e.startedAt).length,
    submittedCount: entries.filter((e) => e.submittedAt).length,
    publishedAt: status === 'draft' ? null : at(Math.min(start, now) - 7 * DAY),
    cancelledAt: status === 'cancelled' ? at(now - DAY) : null,
  });
  await db.question.insertMany(questions);
  if (entries.length) await db.entry.insertMany(entries);
}

/** Published contests per host per month, for the free monthly limit. */
async function seedUsage(db: Models, ids: Types.ObjectId[]) {
  const published = await db.contest
    .find({ hostId: { $in: ids }, status: 'published' })
    .select('hostId publishedAt')
    .lean();
  const counts = new Map<
    string,
    { hostId: Types.ObjectId; month: string; published: number }
  >();
  for (const c of published) {
    const month = usageMonth(c.publishedAt!);
    const key = `${c.hostId.toString()}:${month}`;
    const row = counts.get(key) ?? { hostId: c.hostId, month, published: 0 };
    row.published++;
    counts.set(key, row);
  }
  if (counts.size) await db.usage.insertMany([...counts.values()]);
}

async function seedRooms(
  db: Models,
  rooms: RoomsService,
  ids: Map<string, Types.ObjectId>,
  now: number,
) {
  for (const r of ROOMS) {
    const user = (key: string) => {
      const u = USERS.find((x) => x.key === key)!;
      return {
        userId: ids.get(key)!.toString(),
        username: u.username,
        role: u.role,
      };
    };
    const room = await rooms.create(user(r.owner).userId, r.title);
    for (const key of [r.owner, ...r.guests]) {
      await rooms.joinByCode(room.code, user(key));
    }
    await db.room.updateOne(
      { _id: room._id },
      { $set: { state: r.state, pinnedQuestion: r.pinnedQuestion } },
    );
    let t = now - 20 * MIN;
    const messages = [r.owner, ...r.guests].map((key) => ({
      roomId: room._id,
      senderId: null as Types.ObjectId | null,
      senderName: 'system',
      content: `${user(key).username} joined the room`,
      type: 'system',
      createdAt: at((t += MIN)),
    }));
    for (const [key, content] of r.chat) {
      messages.push({
        roomId: room._id,
        senderId: ids.get(key)!,
        senderName: user(key).username,
        content,
        type: 'user',
        createdAt: at((t += MIN)),
      });
    }
    if (messages.length) await db.message.insertMany(messages);
  }
}

async function main() {
  localMongoUri();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const db = models(app);
  const now = Date.now();

  const others = await removePrevious(db);

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const users = await db.user.insertMany(
    USERS.map((u) => ({
      username: u.username,
      email: `${u.key}@${SEED_DOMAIN}`,
      passwordHash,
      role: u.role,
    })),
  );
  const ids = new Map(USERS.map((u, i) => [u.key, users[i]._id]));

  for (const c of CONTESTS) await seedContest(db, c, ids, now);
  await seedUsage(db, [...ids.values()]);
  await seedRooms(db, app.get(RoomsService), ids, now);

  // Score and rank the ended contests with the app's own finalize code,
  // which also writes activity events and candidate scores.
  const run = await app.get(FinalizeService).finalizeDue(at(now));
  if (others.length) await app.get(ScoreService).recomputeFor(others, at(now));
  await app.close();

  console.log(
    `Seeded ${USERS.length} users, ${CONTESTS.length} contests, ${ROOMS.length} rooms.`,
  );
  console.log(
    `Finalized ${run.finalized.length} contests${run.failed.length ? `, ${run.failed.length} failed` : ''}.`,
  );
  console.log(`\nSign in with any of these, password ${SEED_PASSWORD}:`);
  for (const u of USERS) {
    console.log(
      `  ${u.role.padEnd(11)} ${u.key}@${SEED_DOMAIN}  (${u.username})`,
    );
  }
}

void main();
