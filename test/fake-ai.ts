import {
  AiClient,
  AiToolCall,
  ChatRequest,
  ChatResult,
} from '../src/ai/ai.types';

/** What the fake says next: text, a tool call, or a failure. */
export type FakeReply =
  | { text?: string; toolCalls?: AiToolCall[] }
  | Error
  | ((
      req: ChatRequest,
    ) => Promise<{ text?: string; toolCalls?: AiToolCall[] }>);

export const FEEDBACK_JSON = (areas: string[]) =>
  JSON.stringify({
    summary: 'A solid practice interview with room to grow.',
    areas: areas.map((name, i) => ({ name, score: 2 + (i % 3) })),
    strengths: ['Clear explanations'],
    improve: [{ point: 'Test edge cases', detail: 'Try empty input first.' }],
    questions: [
      {
        title: 'Lists and tuples',
        score: 4,
        note: 'Good',
        tip: 'Go deeper',
        coding: false,
      },
    ],
  });

/**
 * Stands in for the AI provider in tests. Replies come from a queue; once
 * it is empty, conversation turns get a question and feedback requests get
 * valid feedback. Every request is kept for the test to inspect.
 */
export class FakeAi extends AiClient {
  enabled = true;
  readonly requests: ChatRequest[] = [];
  readonly queue: FakeReply[] = [];

  async chat(
    req: ChatRequest,
    onText?: (text: string) => void,
  ): Promise<ChatResult> {
    this.requests.push(req);
    const next = this.queue.shift();
    if (next instanceof Error) throw next;
    const reply =
      typeof next === 'function'
        ? await next(req)
        : (next ??
          (req.json
            ? { text: this.feedbackFor(req) }
            : { text: 'Tell me more?' }));
    const text = reply.text ?? '';
    // Stream it in small pieces, like the real thing.
    for (let i = 0; i < text.length; i += 6) onText?.(text.slice(i, i + 6));
    return {
      text,
      toolCalls: reply.toolCalls ?? [],
      usage: {
        model: 'fake-model',
        promptTokens: 1_000,
        cachedTokens: 800,
        completionTokens: 50,
      },
    };
  }

  /** Valid feedback for the areas the request's schema asks for. */
  private feedbackFor(req: ChatRequest): string {
    const schema = req.json?.schema as {
      properties: {
        areas: { items: { properties: { name: { enum: string[] } } } };
      };
    };
    return FEEDBACK_JSON(schema.properties.areas.items.properties.name.enum);
  }

  last(): ChatRequest {
    return this.requests[this.requests.length - 1];
  }
}
