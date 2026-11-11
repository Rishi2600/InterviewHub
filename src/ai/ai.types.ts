/**
 * Provider-neutral types for the AI layer. Features talk to AiClient; the
 * provider behind it (Groq today) can change without touching them.
 */

export interface AiToolCall {
  id: string;
  name: string;
  /** The tool's arguments as a JSON string, as the model wrote them. */
  arguments: string;
}

export type AiMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: AiToolCall[] }
  | { role: 'tool'; content: string; toolCallId: string };

export interface AiTool {
  name: string;
  description: string;
  /** JSON Schema for the arguments. */
  parameters: Record<string, unknown>;
}

export interface AiUsage {
  model: string;
  promptTokens: number;
  /** Prompt tokens served from the provider's cache. */
  cachedTokens: number;
  completionTokens: number;
}

/** Tokens that count toward the provider's limits: cached ones don't. */
export const countedTokens = (u: AiUsage): number =>
  Math.max(0, u.promptTokens - u.cachedTokens) + u.completionTokens;

export interface ChatRequest {
  messages: AiMessage[];
  tools?: AiTool[];
  /** Most tokens the reply may use, reasoning included. */
  maxTokens: number;
  /** Ask for JSON matching this schema. The reply is not streamed. */
  json?: { name: string; schema: Record<string, unknown> };
  signal?: AbortSignal;
}

export interface ChatResult {
  text: string;
  toolCalls: AiToolCall[];
  usage: AiUsage;
}

/** Every model is at its limit or the service is down: try again later. */
export class AiUnavailableError extends Error {}

/** The AI provider. Tests replace it with a fake. */
export abstract class AiClient {
  /** False when no API key is set: AI features are switched off. */
  abstract readonly enabled: boolean;

  /** Sends the conversation; `onText` gets the reply as it is written. */
  abstract chat(
    req: ChatRequest,
    onText?: (text: string) => void,
  ): Promise<ChatResult>;
}
