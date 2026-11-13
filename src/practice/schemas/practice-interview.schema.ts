import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import {
  PRACTICE_KINDS,
  PRACTICE_LANGUAGES,
  PRACTICE_LEVELS,
  PRACTICE_MODES,
  PRACTICE_PURPOSES,
  PracticeKind,
  PracticeLanguage,
  PracticeLevel,
  PracticeMode,
  type PracticePurpose,
} from '../practice.constants';

export type PracticeInterviewDocument = HydratedDocument<PracticeInterview>;

export const PRACTICE_STATUSES = [
  'active', // running
  'ended', // over, feedback being written
  'done', // feedback ready
  'failed', // feedback couldn't be written in time
  'cancelled', // ended before any answer: no feedback, not counted
] as const;
export type PracticeStatus = (typeof PRACTICE_STATUSES)[number];

export const END_REASONS = ['candidate', 'ai', 'time', 'answers'] as const;
export type EndReason = (typeof END_REASONS)[number];

/**
 * One step of the conversation. What the AI is sent is rendered from these
 * fields the same way every time, so earlier turns stay byte-identical, as
 * a provider's prompt cache needs.
 */
@Schema({ _id: false })
export class Turn {
  @Prop({ type: String, enum: ['ai', 'candidate', 'run'], required: true })
  kind: 'ai' | 'candidate' | 'run';

  @Prop({ default: '' })
  text: string;

  @Prop({ type: Date, required: true })
  at: Date;

  // Candidate turns: the time and answers left when it was sent, and the
  // code if it changed since the last answer.
  @Prop({ type: Number })
  minutesLeft?: number;

  @Prop({ type: Number })
  answersLeft?: number;

  @Prop({ type: String })
  code?: string;

  // AI turns: a tool the AI called with this reply.
  @Prop({ type: SchemaTypes.Mixed })
  tool?: { id: string; name: string; arguments: string };

  // Run turns.
  @Prop({ type: SchemaTypes.Mixed })
  run?: { input: string; output: string; status: string; ms: number };
}
const TurnSchema = SchemaFactory.createForClass(Turn);

export interface CodingQuestion {
  title: string;
  statement: string;
  exampleInput: string;
  exampleOutput: string;
}

export interface Feedback {
  summary: string;
  areas: { name: string; score: number }[];
  strengths: string[];
  improve: { point: string; detail: string }[];
  questions: {
    title: string;
    score: number;
    note: string;
    tip: string;
    coding: boolean;
  }[];
}

/** A practice interview with the AI interviewer. Private to its candidate. */
@Schema({ timestamps: true, collection: 'practice_interviews' })
export class PracticeInterview {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  // An interview, or a prep coach session on the same engine.
  @Prop({ type: String, enum: PRACTICE_PURPOSES, default: 'interview' })
  purpose: PracticePurpose;

  // A coach session's focus area, such as "Edge cases"; null otherwise.
  @Prop({ type: String, default: null })
  focus: string | null;

  @Prop({ type: String, enum: PRACTICE_KINDS, required: true })
  kind: PracticeKind;

  @Prop({ required: true })
  topic: string;

  // The topic was picked at random.
  @Prop({ default: false })
  mixed: boolean;

  @Prop({ type: String, enum: PRACTICE_LEVELS, required: true })
  level: PracticeLevel;

  @Prop({ required: true })
  minutes: number;

  // Technical interviews with a coding question: its language.
  @Prop({ type: String, enum: [...PRACTICE_LANGUAGES, null], default: null })
  language: PracticeLanguage | null;

  @Prop({ type: String, enum: PRACTICE_MODES, default: 'chat' })
  mode: PracticeMode;

  @Prop({ type: String, enum: PRACTICE_STATUSES, default: 'active' })
  status: PracticeStatus;

  // Set only while running: a unique index allows one per candidate.
  @Prop({ type: Boolean })
  running?: true;

  @Prop({ type: Date, required: true })
  startedAt: Date;

  @Prop({ type: Date, required: true })
  endsAt: Date;

  @Prop({ type: Date, default: null })
  endedAt: Date | null;

  @Prop({ type: String, enum: [...END_REASONS, null], default: null })
  endReason: EndReason | null;

  // Questions from the candidate's recent interviews, for the AI to avoid.
  // Fixed at the start so the instructions never change mid-interview.
  @Prop({ type: [String], default: [] })
  avoid: string[];

  @Prop({ default: 0 })
  answers: number;

  // Runs recorded; capped per interview.
  @Prop({ default: 0 })
  runs: number;

  // The conversation. Removed once the feedback is written or given up.
  @Prop({ type: [TurnSchema], default: [] })
  turns: Turn[];

  @Prop({ type: SchemaTypes.Mixed, default: null })
  codingQuestion: CodingQuestion | null;

  // While the AI is replying: other answers wait. Expires on its own if the
  // server dies mid-reply.
  @Prop({ type: Date, default: null })
  busyUntil: Date | null;

  // The UTC day whose AI budget this interview set aside, and how much.
  @Prop({ type: SchemaTypes.Mixed, required: true })
  quota: { day: string; requests: number; tokens: number };

  // What it actually used, feedback included.
  @Prop({ default: 0 })
  usedRequests: number;

  @Prop({ default: 0 })
  usedTokens: number;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  feedback: Feedback | null;

  // The average of the feedback areas, for lists and the trend chart.
  @Prop({ type: Number, default: null })
  score: number | null;

  // Feedback writing: claimed by one server at a time.
  @Prop({ type: Date, default: null })
  feedbackLeaseUntil: Date | null;

  @Prop({ default: 0 })
  feedbackTries: number;
}

export const PracticeInterviewSchema =
  SchemaFactory.createForClass(PracticeInterview);
PracticeInterviewSchema.index(
  { userId: 1, running: 1 },
  { unique: true, partialFilterExpression: { running: true } },
);
PracticeInterviewSchema.index({ userId: 1, startedAt: -1 });
// The every-minute job: overdue interviews and feedback still to write.
PracticeInterviewSchema.index({ status: 1, endsAt: 1 });
