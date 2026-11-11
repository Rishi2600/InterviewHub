import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiClient,
  AiMessage,
  AiToolCall,
  AiUnavailableError,
  AiUsage,
  ChatRequest,
  ChatResult,
} from './ai.types';

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const TIMEOUT_MS = 60_000;
// When every model is at its limit, wait this long at most for the soonest
// one, then give up.
const MAX_WAIT_MS = 8_000;
const DEFAULT_REST_MS = 60_000;

/** The model said no for now; `waitMs` is how long until it may say yes. */
class RateLimited extends Error {
  constructor(readonly waitMs: number) {
    super('Rate limited');
  }
}
/** Worth trying the next model: the request never reached a reply. */
class TryNext extends Error {}

interface WireToolCall {
  index: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}
interface WireChunk {
  choices?: { delta?: { content?: string; tool_calls?: WireToolCall[] } }[];
  usage?: WireUsage;
  error?: { message?: string };
}
interface WireUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
}
interface WireReply {
  choices: { message: { content?: string; tool_calls?: WireToolCall[] } }[];
  usage?: WireUsage;
}

/**
 * Groq's OpenAI-compatible chat API, called with fetch so the rate-limit
 * headers stay visible. Models are tried in order (AI_MODELS): one that hits
 * its limit rests until Groq says it may be used again, and the next one
 * takes over. See docs/learning/ai/.
 */
@Injectable()
export class GroqClient extends AiClient {
  private readonly logger = new Logger(GroqClient.name);
  private readonly key: string;
  private readonly models: string[];
  /** Models at their limit, and when they may be tried again. */
  private readonly restingUntil = new Map<string, number>();

  constructor(config: ConfigService) {
    super();
    this.key = config.get<string>('GROQ_API_KEY') ?? '';
    this.models = (config.get<string>('AI_MODELS') ?? '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
  }

  get enabled(): boolean {
    return this.key !== '' && this.models.length > 0;
  }

  async chat(
    req: ChatRequest,
    onText?: (text: string) => void,
  ): Promise<ChatResult> {
    if (!this.enabled) throw new AiUnavailableError('AI is not set up');
    for (let attempt = 0; attempt < 2; attempt++) {
      for (const model of this.models) {
        if ((this.restingUntil.get(model) ?? 0) > Date.now()) continue;
        try {
          return await this.callModel(model, req, onText);
        } catch (err) {
          if (err instanceof RateLimited) {
            this.restingUntil.set(model, Date.now() + err.waitMs);
          } else if (!(err instanceof TryNext)) {
            throw err;
          }
        }
      }
      // Every model is resting: wait for the soonest if it's close.
      const wait = Math.min(
        ...this.models.map((m) => (this.restingUntil.get(m) ?? 0) - Date.now()),
      );
      if (attempt > 0 || wait > MAX_WAIT_MS) break;
      await new Promise((r) => setTimeout(r, Math.max(0, wait)));
    }
    throw new AiUnavailableError('The AI is busy right now');
  }

  private async callModel(
    model: string,
    req: ChatRequest,
    onText?: (text: string) => void,
  ): Promise<ChatResult> {
    const stream = !req.json;
    const body = {
      model,
      messages: req.messages.map(toWire),
      max_completion_tokens: req.maxTokens,
      ...reasoningParams(model),
      ...(req.tools?.length && {
        tools: req.tools.map((t) => ({ type: 'function', function: t })),
      }),
      ...(req.json
        ? {
            response_format: {
              type: 'json_schema',
              json_schema: { ...req.json, strict: true },
            },
          }
        : { stream: true, stream_options: { include_usage: true } }),
    };
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: req.signal ? AbortSignal.any([req.signal, timeout]) : timeout,
      });
    } catch (err) {
      if (req.signal?.aborted) throw err;
      this.logger.warn(`${model}: ${(err as Error).message}`);
      throw new TryNext();
    }

    if (res.status === 429) {
      const seconds = Number(res.headers.get('retry-after'));
      throw new RateLimited(
        Number.isFinite(seconds) && seconds > 0
          ? seconds * 1000
          : DEFAULT_REST_MS,
      );
    }
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      this.logger.error(`${model}: HTTP ${res.status} ${detail}`);
      if (res.status >= 500) throw new TryNext();
      throw new AiUnavailableError(
        `The AI refused the request (${res.status})`,
      );
    }
    return stream
      ? this.readStream(model, res, onText)
      : this.readReply(model, (await res.json()) as WireReply);
  }

  private readReply(model: string, reply: WireReply): ChatResult {
    const message = reply.choices[0]?.message ?? {};
    return {
      text: message.content ?? '',
      toolCalls: collectToolCalls(message.tool_calls ?? []),
      usage: toUsage(model, reply.usage),
    };
  }

  /** Reads server-sent events: one JSON chunk per `data:` line. */
  private async readStream(
    model: string,
    res: Response,
    onText?: (text: string) => void,
  ): Promise<ChatResult> {
    let text = '';
    const calls: WireToolCall[] = [];
    let usage: WireUsage | undefined;
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const bytes of res.body as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(bytes, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;
        const chunk = JSON.parse(payload) as WireChunk;
        if (chunk.error) {
          throw new AiUnavailableError(chunk.error.message ?? 'AI error');
        }
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          text += delta.content;
          onText?.(delta.content);
        }
        if (delta?.tool_calls) calls.push(...delta.tool_calls);
        if (chunk.usage) usage = chunk.usage;
      }
    }
    return {
      text,
      toolCalls: collectToolCalls(calls),
      usage: toUsage(model, usage),
    };
  }
}

/** gpt-oss reasons before it answers: keep that short and out of the reply. */
function reasoningParams(model: string): Record<string, unknown> {
  if (model.startsWith('openai/gpt-oss')) {
    return { reasoning_effort: 'low', include_reasoning: false };
  }
  if (model.startsWith('qwen/')) return { reasoning_effort: 'none' };
  return {};
}

function toWire(m: AiMessage): Record<string, unknown> {
  if (m.role === 'tool') {
    return { role: 'tool', content: m.content, tool_call_id: m.toolCallId };
  }
  if (m.role === 'assistant' && m.toolCalls?.length) {
    return {
      role: 'assistant',
      content: m.content,
      tool_calls: m.toolCalls.map((c) => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: c.arguments },
      })),
    };
  }
  return { role: m.role, content: m.content };
}

/** Streamed tool calls arrive in pieces, joined here by their index. */
function collectToolCalls(parts: WireToolCall[]): AiToolCall[] {
  const byIndex = new Map<number, AiToolCall>();
  for (const p of parts) {
    const call = byIndex.get(p.index ?? 0) ?? {
      id: '',
      name: '',
      arguments: '',
    };
    call.id ||= p.id ?? '';
    call.name += p.function?.name ?? '';
    call.arguments += p.function?.arguments ?? '';
    byIndex.set(p.index ?? 0, call);
  }
  return [...byIndex.values()];
}

function toUsage(model: string, u: WireUsage | undefined): AiUsage {
  return {
    model,
    promptTokens: u?.prompt_tokens ?? 0,
    cachedTokens: u?.prompt_tokens_details?.cached_tokens ?? 0,
    completionTokens: u?.completion_tokens ?? 0,
  };
}
