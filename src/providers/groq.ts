import { McError, type ChatParams, type ChatProvider, type ModelInfo } from '../types';
import { openaiChat, buildMessages } from '../lib/sse';
import { getKey } from '../lib/keys';

/**
 * Tier 2 — Groq (BYOK). OpenAI-compatible endpoint.
 * POST https://api.groq.com/openai/v1/chat/completions
 * Models below + any custom id via Settings → custom models ("groq/<id>").
 */

const STATIC: ModelInfo[] = [
  { id: 'groq/openai/gpt-oss-120b', model: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B · Groq', providerId: 'groq', free: false, badge: '🚀' },
  { id: 'groq/openai/gpt-oss-20b', model: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B · Groq', providerId: 'groq', free: false },
  { id: 'groq/llama-3.3-70b-versatile', model: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B · Groq', providerId: 'groq', free: false, badge: '🚀' },
  { id: 'groq/llama-3.1-8b-instant', model: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B · instant', providerId: 'groq', free: false, badge: '⚡' },
  { id: 'groq/moonshotai/kimi-k2-instruct-0905', model: 'moonshotai/kimi-k2-instruct-0905', name: 'Kimi K2 · Groq', providerId: 'groq', free: false },
  { id: 'groq/qwen/qwen3-32b', model: 'qwen/qwen3-32b', name: 'Qwen 3 32B · Groq', providerId: 'groq', free: false },
];

export const models: ModelInfo[] = [...STATIC];

async function chat(p: ChatParams): Promise<string> {
  const key = getKey('groq');
  if (!key) {
    // fail fast with a clear, non-retried error instead of a pointless 401
    throw new McError('key', 'Groq API key required', false);
  }
  return openaiChat({
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key,
    body: {
      model: p.model.model,
      messages: buildMessages(p.messages, p.systemPrompt),
      temperature: p.temperature ?? 0.8,
      max_tokens: p.maxTokens ?? 2048,
    },
    onToken: p.onToken,
    signal: p.signal,
    onStatus: p.onStatus,
  });
}

export const groq: ChatProvider = {
  id: 'groq',
  name: 'Groq',
  requiresKey: true,
  models,
  chat,
};
