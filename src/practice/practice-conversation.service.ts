import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { WsException } from '@nestjs/websockets';
import { Model, Types, UpdateQuery } from 'mongoose';
import {
  AiClient,
  AiToolCall,
  AiUnavailableError,
  ChatResult,
  countedTokens,
} from '../ai/ai.types';
import { AiBudgetService } from './ai-budget.service';
import { PracticeNotifier } from './practice.notifier';
import { PracticeService } from './practice.service';
import { PRACTICE_LIMITS } from './practice.constants';
import { turnView } from './practice.views';
import {
  cleanReply,
  conversation,
  END_LINE,
  interviewTools,
  POSE_LINE,
  REPLY_MAX_TOKENS,
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
 * practice:delta (reply text as it arrives), practice:question (the coding
 * question), practice:retracted (an answer the AI couldn't reply to).
 */
@Injectable()
export class PracticeConversationService {
  private readonly logger = new Logger(PracticeConversationService.name);

  constructor(
    @InjectModel(PracticeInterview.name)
    private readonly model: Model<PracticeInterview>,
    private readonly ai: AiClient,
    private readonly budget: AiBudgetService,
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
        message: this.failure(err, 'start'),
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
        'status endsAt answers language codingQuestion turns.kind turns.code',
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
      throw new WsException('Wait for the interviewer to start');
    }
    const turn: Turn = {
      kind: 'candidate',
      text: input.text,
      at: now,
      minutesLeft: Math.ceil(
        (current.endsAt.getTime() - now.getTime()) / 60_000,
      ),
      answersLeft: PRACTICE_LIMITS.maxAnswers - current.answers - 1,
      code: changedCode(current, input.code),
    };
    const iv = await this.claim(
      {
        _id: current._id,
        userId,
        status: 'active',
        answers: { $lt: PRACTICE_LIMITS.maxAnswers },
      },
      { $push: { turns: turn }, $inc: { answers: 1 } },
      now,
    );
    if (!iv) throw new WsException('Wait for the interviewer to finish');
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
      const message = this.failure(err, 'reply');
      this.notifier.emit(id, 'practice:retracted', {
        at: now,
        text: input.text,
        message,
      });
      return { ok: false, message };
    }
    if (iv.answers >= PRACTICE_LIMITS.maxAnswers) {
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
    const result = await this.ai.chat(
      {
        messages: conversation(iv, iv.avoid),
        tools: interviewTools(!!iv.language),
        maxTokens: REPLY_MAX_TOKENS,
      },
      (text) => this.notifier.emit(id, 'practice:delta', { text }),
    );
    const tokens = countedTokens(result.usage);
    await this.budget.spent(iv.quota, tokens);
    let next: ReturnType<typeof toTurn>;
    try {
      next = toTurn(result, !!iv.language);
    } catch (err) {
      await this.spent(iv._id, tokens);
      throw err;
    }
    const { turn, question, end } = next;
    await this.model
      .updateOne(
        { _id: iv._id },
        {
          $push: { turns: turn },
          $set: {
            busyUntil: null,
            ...(question && { codingQuestion: question }),
          },
          $inc: { usedRequests: 1, usedTokens: tokens },
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

  private failure(err: unknown, when: 'start' | 'reply'): string {
    if (!(err instanceof AiUnavailableError)) {
      this.logger.error(`AI ${when} failed: ${(err as Error).message}`);
    }
    return when === 'start'
      ? "The interviewer couldn't start just now. Try again in a minute."
      : "The interviewer couldn't reply just now. Try sending again in a minute.";
  }
}

/**
 * The AI's result as a turn. A tool call without words gets a fixed line,
 * so it costs no second request. Throws if the reply is unusable.
 */
function toTurn(result: ChatResult, coding: boolean) {
  const cleaned = cleanReply(result.text, coding);
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
    text ||= POSE_LINE;
  } else if (call?.name === 'end_interview') {
    end = true;
    text ||= END_LINE;
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
