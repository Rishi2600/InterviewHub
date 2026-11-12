import { ConfigService } from '@nestjs/config';
import { AiUnavailableError, countedTokens } from './ai.types';
import { GroqClient, PREP_GROQ } from './groq.client';

const config = (values: Record<string, string>) =>
  ({ get: (k: string) => values[k] }) as unknown as ConfigService;

const client = () =>
  new GroqClient(
    config({ GROQ_API_KEY: 'gsk_test', AI_MODELS: 'model-a, model-b' }),
  );

/** A streamed reply as Groq sends it: one `data:` line per chunk. */
function sse(chunks: object[], split = 7): Response {
  const text =
    chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') +
    'data: [DONE]\n\n';
  // Cut into small pieces so lines span reads, as they do on the network.
  const pieces: Uint8Array[] = [];
  for (let i = 0; i < text.length; i += split) {
    pieces.push(new TextEncoder().encode(text.slice(i, i + split)));
  }
  return new Response(
    new ReadableStream({
      start(c) {
        pieces.forEach((p) => c.enqueue(p));
        c.close();
      },
    }),
    { status: 200 },
  );
}
const delta = (d: object) => ({ choices: [{ delta: d }] });
const usage = {
  choices: [],
  usage: {
    prompt_tokens: 1000,
    completion_tokens: 50,
    prompt_tokens_details: { cached_tokens: 900 },
  },
};
const limited = (seconds?: number) =>
  new Response('{}', {
    status: 429,
    headers: seconds ? { 'retry-after': String(seconds) } : {},
  });

describe('GroqClient', () => {
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  const sentBody = (call = 0) =>
    JSON.parse(fetchMock.mock.calls[call][1].body as string) as Record<
      string,
      unknown
    >;

  it('is off without a key', async () => {
    const off = new GroqClient(config({ AI_MODELS: 'model-a' }));
    expect(off.enabled).toBe(false);
    await expect(off.chat({ messages: [], maxTokens: 10 })).rejects.toThrow(
      AiUnavailableError,
    );
  });

  it("gives prep its own key and models, falling back to practice's key", async () => {
    const shared = config({
      GROQ_API_KEY: 'gsk_main',
      AI_PREP_MODELS: 'model-p',
    });
    const own = config({
      GROQ_API_KEY: 'gsk_main',
      GROQ_API_KEY_PREP: 'gsk_prep',
      AI_PREP_MODELS: 'model-p',
    });
    for (const [values, key] of [
      [shared, 'gsk_main'],
      [own, 'gsk_prep'],
    ] as const) {
      fetchMock.mockResolvedValueOnce(sse([delta({ content: 'Hi.' }), usage]));
      await new GroqClient(values, PREP_GROQ).chat({
        messages: [],
        maxTokens: 10,
      });
      const [, init] = fetchMock.mock.calls.at(-1)!;
      expect((init.headers as Record<string, string>).Authorization).toBe(
        `Bearer ${key}`,
      );
      expect(JSON.parse(init.body as string).model).toBe('model-p');
    }
  });

  it('streams the reply so far and reads usage from the last chunk', async () => {
    fetchMock.mockResolvedValueOnce(
      sse([delta({ content: 'Hello ' }), delta({ content: 'there.' }), usage]),
    );
    const pieces: string[] = [];
    const result = await client().chat(
      { messages: [{ role: 'user', content: 'Hi' }], maxTokens: 100 },
      (t) => pieces.push(t),
    );
    expect(pieces).toEqual(['Hello ', 'Hello there.']);
    expect(result.text).toBe('Hello there.');
    expect(result.usage).toEqual({
      model: 'model-a',
      promptTokens: 1000,
      cachedTokens: 900,
      completionTokens: 50,
    });
    expect(countedTokens(result.usage)).toBe(150);
    expect(sentBody()).toMatchObject({ model: 'model-a', stream: true });
  });

  it('joins a tool call streamed in pieces', async () => {
    fetchMock.mockResolvedValueOnce(
      sse([
        delta({
          tool_calls: [
            {
              index: 0,
              id: 'call_1',
              function: { name: 'end_', arguments: '' },
            },
          ],
        }),
        delta({
          tool_calls: [
            { index: 0, function: { name: 'interview', arguments: '{}' } },
          ],
        }),
        usage,
      ]),
    );
    const result = await client().chat({ messages: [], maxTokens: 100 });
    expect(result.toolCalls).toEqual([
      { id: 'call_1', name: 'end_interview', arguments: '{}' },
    ]);
  });

  it('moves to the next model when one is at its limit, and lets it rest', async () => {
    const groq = client();
    fetchMock
      .mockResolvedValueOnce(limited(120))
      .mockResolvedValueOnce(sse([delta({ content: 'B' }), usage]))
      .mockResolvedValueOnce(sse([delta({ content: 'B again' }), usage]));
    const first = await groq.chat({ messages: [], maxTokens: 10 });
    expect(first.usage.model).toBe('model-b');
    // model-a is resting for two minutes, so it isn't asked again.
    const second = await groq.chat({ messages: [], maxTokens: 10 });
    expect(second.text).toBe('B again');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sentBody(2).model).toBe('model-b');
  });

  it('waits a few seconds for the first model rather than skip it', async () => {
    fetchMock
      .mockResolvedValueOnce(limited(1))
      .mockResolvedValueOnce(sse([delta({ content: 'A' }), usage]));
    const result = await client().chat({ messages: [], maxTokens: 10 });
    expect(result.usage.model).toBe('model-a');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('asks again after a broken tool call, then tries the next model', async () => {
    const broken = sse([
      delta({ content: 'Let' }),
      {
        error: {
          message: 'Tool call validation failed',
          code: 'tool_use_failed',
        },
      },
    ]);
    fetchMock
      .mockResolvedValueOnce(broken)
      .mockResolvedValueOnce(sse([delta({ content: 'Fixed' }), usage]));
    const fixed = await client().chat({ messages: [], maxTokens: 10 });
    expect(fixed.text).toBe('Fixed');
    expect(fixed.usage.model).toBe('model-a');

    const refused = () =>
      new Response('{"error":{"code":"tool_use_failed"}}', { status: 400 });
    fetchMock
      .mockResolvedValueOnce(refused())
      .mockResolvedValueOnce(refused())
      .mockResolvedValueOnce(sse([delta({ content: 'B' }), usage]));
    const next = await client().chat({ messages: [], maxTokens: 10 });
    expect(next.usage.model).toBe('model-b');
  });

  it('gives up when every model is at its limit for long', async () => {
    fetchMock.mockResolvedValue(limited(300));
    await expect(
      client().chat({ messages: [], maxTokens: 10 }),
    ).rejects.toThrow(AiUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('tries the next model after a server error', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('down', { status: 503 }))
      .mockResolvedValueOnce(sse([delta({ content: 'ok' }), usage]));
    const result = await client().chat({ messages: [], maxTokens: 10 });
    expect(result.usage.model).toBe('model-b');
  });

  it('asks for JSON without streaming', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"ok":true}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      ),
    );
    const result = await client().chat({
      messages: [],
      maxTokens: 10,
      json: { name: 'thing', schema: { type: 'object' } },
    });
    expect(result.text).toBe('{"ok":true}');
    const body = sentBody();
    expect(body.stream).toBeUndefined();
    expect(body.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: { name: 'thing', strict: true },
    });
  });

  it('sends tool calls and results in the provider format', async () => {
    fetchMock.mockResolvedValueOnce(sse([usage]));
    await client().chat({
      maxTokens: 10,
      messages: [
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'c1', name: 'end_interview', arguments: '{}' }],
        },
        { role: 'tool', content: 'done', toolCallId: 'c1' },
      ],
    });
    expect(sentBody().messages).toEqual([
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'c1',
            type: 'function',
            function: { name: 'end_interview', arguments: '{}' },
          },
        ],
      },
      { role: 'tool', content: 'done', tool_call_id: 'c1' },
    ]);
  });
});
