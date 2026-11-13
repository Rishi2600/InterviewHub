import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { WsException } from '@nestjs/websockets';
import { Model, Types, UpdateQuery } from 'mongoose';
import {
  AiToolCall,
  AiUnavailableError,
  ChatResult,
  countedTokens,
} from '../ai/ai.types';
import { PracticeEngines } from './practice-engines';
import { PracticeNotifier } from './practice.notifier';
import { PracticeService } from './practice.service';
import { answerLimit, PRACTICE_LIMITS } from './practice.constants';
import { turnView } from './practice.views';
import {
  cleanReply,
  conversation,
  draftReply,
  questionCount,
  interviewTools,
  REPLY_MAX_TOKENS,
  toolLines,
} from './prompts';
import {
  CodingQuestion,
  PracticeInterview,
  Turn,
} from './schemas/practice-interview.schema';

// How long a reply may hold the interview. Longer than a slow AI call with
// a fallback; it runs out on its own if the server dies mid-reply.
const BUSY_MS = 90_000;
// Runs recorded per interview.
const MAX_RUNS = 60;
const RUN_FIELD_CHARS = 4_000;

type Stored = PracticeInterview & { _id: Types.ObjectId };

export interface RunInput {
  input: string;
  output: string;
  status: 'ok' | 'error' | 'timeout';
  ms: number;
}

const clip = (s: string, max: number) =>
  s.length > max ? `${s.slice(0, max)}\n… (cut)` : s;

/**
 * The conversation: the AI's opening, each answer and the AI's reply as it
 * is written, and Runs. One reply at a time per interview: claiming the
 * interview sets `busyUntil`, so a second answer waits.
 *
 * Events sent to the interview's room: practice:turn (a finished turn),
 * practice:draft (the reply so far, cleaned), practice:question (the coding
 * question), practice:retracted (an answer the AI couldn't reply to).
 */
@Injectable()
export class PracticeConversationService {
  private readonly logger = new Logger(PracticeConversationService.name);

  constructor(
    @InjectModel(PracticeInterview.name)
    private readonly model: Model<PracticeInterview>,
    private readonly engines: PracticeEngines,
    private readonly practice: PracticeService,
    private readonly notifier: PracticeNotifier,
  ) {}

  /** The greeting and first question, once, when the interview is opened. */
  async open(id: Types.ObjectId, userId: Types.ObjectId, now = new Date()) {
    const iv = await this.claim(
      { _id: id, userId, status: 'active', turns: { $size: 0 } },
      {},
      now,
    );
    if (!iv) return;
    try {
      await this.reply(iv);
    } catch (err) {
      await this.release(iv._id);
      this.notifier.emit(id.toString(), 'practice:failed', {
        message: this.failure(err, 'start', iv.purpose),
      });
    }
  }

  /** The candidate's answer, then the AI's reply. */
  async answer(
    id: string,
    userId: Types.ObjectId,
    input: { text: string; code?: string },
    now = new Date(),
  ): Promise<{ ok: boolean; message?: string }> {
    const current = await this.model
      .findOne({ _id: id, userId })
      .select(
        'purpose status endsAt answers language codingQuestion turns.kind turns.code',
      )
      .lean()
      .exec();
    if (!current || current.status !== 'active') {
      throw new WsException('This interview has ended');
    }
    if (current.endsAt <= now) {
      await this.practice.end(current._id, 'time', now);
      throw new WsException('Time is up');
    }
    if (!current.turns.length) {
      throw new WsException(
        current.purpose === 'coach'
          ? 'Wait for the coach to start'
          : 'Wait for the interviewer to start',
      );
    }
    const limit = answerLimit(current.purpose);
    const turn: Turn = {
      kind: 'candidate',
      text: input.text,
      at: now,
      minutesLeft: Math.ceil(
        (current.endsAt.getTime() - now.getTime()) / 60_000,
      ),
      answersLeft: limit - current.answers - 1,
      code: changedCode(current, input.code),
    };
    const iv = await this.claim(
      {
        _id: current._id,
        userId,
        status: 'active',
        answers: { $lt: limit },
      },
      { $push: { turns: turn }, $inc: { answers: 1 } },
      now,
    );
    if (!iv) {
      throw new WsException(
        current.purpose === 'coach'
          ? 'Wait for the coach to finish'
          : 'Wait for the interviewer to finish',
      );
    }
    this.notifier.emit(id, 'practice:turn', turnView(turn));

    try {
      await this.reply(iv);
    } catch (err) {
      // Take the answer back so it can be sent again.
      await this.model
        .updateOne(
          { _id: iv._id },
          {
            $pull: { turns: { kind: 'candidate', at: now } },
            $inc: { answers: -1 },
            $set: { busyUntil: null },
          },
        )
        .exec();
      const message = this.failure(err, 'reply', iv.purpose);
      this.notifier.emit(id, 'practice:retracted', {
        at: now,
        text: input.text,
        message,
      });
      return { ok: false, message };
    }
    if (iv.answers >= limit) {
      await this.practice.end(iv._id, 'answers');
    }
    return { ok: true };
  }

  /** A Run of the candidate's code: the AI sees it with the next answer. */
  async run(
    id: string,
    userId: Types.ObjectId,
    run: RunInput,
    now = new Date(),
  ) {
    const turn: Turn = {
      kind: 'run',
      text: '',
      at: now,
      run: {
        input: clip(run.input, RUN_FIELD_CHARS),
        output: clip(run.output, RUN_FIELD_CHARS),
        status: run.status,
        ms: run.ms,
      },
    };
    const { modifiedCount } = await this.model
      .updateOne(
        {
          _id: id,
          userId,
          status: 'active',
          language: { $ne: null },
          runs: { $lt: MAX_RUNS },
        },
        { $push: { turns: turn }, $inc: { runs: 1 } },
      )
      .exec();
    if (!modifiedCount) throw new WsException("This Run wasn't recorded");
    this.notifier.emit(id, 'practice:turn', turnView(turn));
  }

  /** Asks the AI for its next turn, streaming it to the room. */
  private async reply(iv: Stored): Promise<void> {
    const id = iv._id.toString();
    const { ai, budget } = this.engines.for(iv);
    const ask = async (nudge?: string) => {
      // The candidate sees the reply cleaned as it streams: the whole draft
      // each time it changes, never a raw remark.
      let shown = '';
      const result = await ai.chat(
        {
          messages: [
            ...conversation(iv, iv.avoid),
            ...(nudge ? [{ role: 'system' as const, content: nudge }] : []),
          ],
          tools: interviewTools(!!iv.language),
          maxTokens: REPLY_MAX_TOKENS,
        },
        (soFar) => {
          const draft = draftReply(soFar);
          if (draft !== shown) {
            shown = draft;
            this.notifier.emit(id, 'practice:draft', { text: draft });
          }
        },
      );
      const tokens = countedTokens(result.usage);
      await budget.spent(iv.quota, tokens);
      await this.spent(iv._id, tokens);
      return result;
    };

    let result = await ask();
    // Ending or posing the coding question far too early: ask once more,
    // with a note saying why. A second call is taken as meant.
    const early = tooEarly(result.toolCalls[0], iv);
    if (early) {
      this.logger.log(
        `Asked again: ${result.toolCalls[0].name} came too early`,
      );
      this.notifier.emit(id, 'practice:draft', { text: '' });
      result = await ask(early);
    }
    const { turn, question, end } = toTurn(result, iv);
    await this.model
      .updateOne(
        { _id: iv._id },
        {
          $push: { turns: turn },
          $set: {
            busyUntil: null,
            ...(question && { codingQuestion: question }),
          },
        },
      )
      .exec();
    this.notifier.emit(id, 'practice:turn', turnView(turn));
    if (question) this.notifier.emit(id, 'practice:question', question);
    if (end) await this.practice.end(iv._id, 'ai');
  }

  /** Claims the interview for one reply, applying `update` at the same time. */
  private claim(
    filter: Record<string, unknown>,
    update: UpdateQuery<PracticeInterview>,
    now: Date,
  ) {
    return this.model
      .findOneAndUpdate(
        {
          ...filter,
          $or: [{ busyUntil: null }, { busyUntil: { $lt: now } }],
        },
        {
          ...update,
          $set: { busyUntil: new Date(now.getTime() + BUSY_MS) },
        },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();
  }

  private async release(id: Types.ObjectId) {
    await this.model
      .updateOne({ _id: id }, { $set: { busyUntil: null } })
      .exec();
  }

  private async spent(id: Types.ObjectId, tokens: number) {
    await this.model
      .updateOne({ _id: id }, { $inc: { usedRequests: 1, usedTokens: tokens } })
      .exec();
  }

  private failure(
    err: unknown,
    when: 'start' | 'reply',
    purpose?: Stored['purpose'],
  ): string {
    if (!(err instanceof AiUnavailableError)) {
      this.logger.error(`AI ${when} failed: ${(err as Error).message}`);
    }
    const who = purpose === 'coach' ? 'coach' : 'interviewer';
    return when === 'start'
      ? `The ${who} couldn't start just now. Try again in a minute.`
      : `The ${who} couldn't reply just now. Try sending again in a minute.`;
  }
}

/**
 * The AI's result as a turn. A tool call without words gets a fixed line,
 * so it costs no second request. Throws if the reply is unusable.
 */
function toTurn(result: ChatResult, iv: Pick<Stored, 'language' | 'purpose'>) {
  const lines = toolLines(iv.purpose);
  const cleaned = cleanReply(result.text, !!iv.language);
  let call: AiToolCall | undefined = result.toolCalls[0];
  let text = cleaned.text;
  // A question written out as JSON instead of the tool call: treat it as
  // the call, so it still reaches the editor and the history stays right.
  if (!call && cleaned.question) {
    call = {
      id: `call_${Date.now()}`,
      name: 'pose_coding_question',
      arguments: cleaned.question,
    };
  }
  let question: CodingQuestion | null = null;
  let end = false;
  if (call?.name === 'pose_coding_question') {
    question = parseQuestion(call.arguments);
    // Whatever else it wrote alongside tends to be another question.
    text = lines.pose;
  } else if (call?.name === 'end_interview') {
    end = true;
    text ||= lines.end;
  }
  if (!text) throw new AiUnavailableError('The AI sent an empty reply');
  const turn: Turn = {
    kind: 'ai',
    text,
    at: new Date(),
    ...((question || end) && { tool: call }),
  };
  return { turn, question, end };
}

// The candidate asks to stop, or to move on to the code.
const ASKS_TO_STOP =
  /\b(stop|end (it|this|the interview|here|now)|finish|quit|wrap (it )?up|that'?s (all|enough)|i'?m done)\b/i;
const ASKS_FOR_CODE = /\b(cod(e|ing)|program|problem)\b/i;

/**
 * Why a tool call comes far too early, as a note for the AI, or null when
 * it's fine. Weaker models end after a few answers, or jump to the coding
 * question straight away.
 */
function tooEarly(
  call: AiToolCall | undefined,
  iv: Pick<
    Stored,
    | 'kind'
    | 'minutes'
    | 'language'
    | 'answers'
    | 'turns'
    | 'codingQuestion'
    | 'purpose'
  >,
): string | null {
  if (!call) return null;
  const last = iv.turns.findLast((t) => t.kind === 'candidate');
  const minutesLeft = last?.minutesLeft ?? iv.minutes;
  const used = 1 - minutesLeft / iv.minutes;
  if (iv.purpose === 'coach') {
    // A coach may set its exercise whenever it fits, and end once a few
    // ideas are covered.
    if (call.name !== 'end_interview') return null;
    const done =
      used >= 0.5 ||
      (last?.answersLeft ?? answerLimit('coach')) <= 3 ||
      iv.answers >= 6 ||
      ASKS_TO_STOP.test(last?.text ?? '');
    return done
      ? null
      : `Don't end the session yet: about ${minutesLeft} minutes are left. Carry on with the next idea.`;
  }
  const planned = questionCount(iv);
  if (call.name === 'end_interview') {
    const done =
      used >= 0.6 ||
      (last?.answersLeft ?? PRACTICE_LIMITS.maxAnswers) <= 3 ||
      iv.answers >= planned + (iv.language ? 4 : 1) ||
      ASKS_TO_STOP.test(last?.text ?? '');
    return done
      ? null
      : `Don't end the interview yet: about ${minutesLeft} minutes are left. Carry on with your next question.`;
  }
  if (call.name === 'pose_coding_question' && !iv.codingQuestion) {
    const due =
      used >= 0.35 ||
      iv.answers >= Math.max(1, Math.floor(planned / 2)) ||
      ASKS_FOR_CODE.test(last?.text ?? '');
    return due
      ? null
      : 'Not yet: ask a few concept questions first, then the coding question.';
  }
  return null;
}

/**
 * The code, once there is a coding question and only if it changed since
 * the last answer that carried it.
 */
function changedCode(
  iv: {
    language: string | null;
    codingQuestion: CodingQuestion | null;
    turns: Pick<Turn, 'kind' | 'code'>[];
  },
  code: string | undefined,
): string | undefined {
  if (!iv.language || !iv.codingQuestion || !code?.trim()) return undefined;
  const clipped = clip(code, PRACTICE_LIMITS.codeChars);
  const last = iv.turns.findLast((t) => t.kind === 'candidate' && t.code);
  return last?.code === clipped ? undefined : clipped;
}

/** The coding question from the tool's arguments; throws if unusable. */
function parseQuestion(args: string): CodingQuestion {
  const a = JSON.parse(args) as Record<string, unknown>;
  const str = (v: unknown, max: number) =>
    typeof v === 'string' ? v.trim().slice(0, max) : '';
  const q = {
    title: str(a.title, 100),
    statement: str(a.statement, 4_000),
    exampleInput: str(a.example_input, 2_000),
    exampleOutput: str(a.example_output, 2_000),
  };
  if (!q.title || !q.statement) {
    throw new AiUnavailableError('The coding question was incomplete');
  }
  return q;
}
