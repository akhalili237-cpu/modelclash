import { McError, type ChatParams, type ChatProvider, type ModelInfo } from '../types';
import { openaiChat, buildMessages } from '../lib/sse';
import { getKey } from '../lib/keys';

/**
 * Tier 2 — OpenRouter (BYOK). Catalog fetched live, ":free" models flagged.
 * POST https://openrouter.ai/api/v1/chat/completions
 * Headers: Authorization, HTTP-Referer, X-Title
 */

const CACHE_LS = 'mc.or.models';
const CACHE_TTL = 24 * 60 * 60 * 1000;

const STATIC: ModelInfo[] = [
  // OpenAI — GPT-5 family (2026 frontier). noTemp: OpenAI reasoning models reject temperature/top_p.
  { id: 'openrouter/openai/gpt-5.5', model: 'openai/gpt-5.5', name: 'GPT-5.5', providerId: 'openrouter', free: false, badge: '🧠', noTemp: true },
  { id: 'openrouter/openai/gpt-5.5-pro', model: 'openai/gpt-5.5-pro', name: 'GPT-5.5 Pro', providerId: 'openrouter', free: false, noTemp: true },
  { id: 'openrouter/openai/gpt-5.4-mini', model: 'openai/gpt-5.4-mini', name: 'GPT-5.4 Mini', providerId: 'openrouter', free: false, badge: '⚡', noTemp: true },
  { id: 'openrouter/openai/gpt-5-nano', model: 'openai/gpt-5-nano', name: 'GPT-5 Nano', providerId: 'openrouter', free: false, noTemp: true },
  // Anthropic — Claude 5 family
  { id: 'openrouter/anthropic/claude-opus-5.5', model: 'anthropic/claude-opus-5.5', name: 'Claude Opus 5.5', providerId: 'openrouter', free: false, badge: '🎭' },
  { id: 'openrouter/anthropic/claude-sonnet-5.5', model: 'anthropic/claude-sonnet-5.5', name: 'Claude Sonnet 5.5', providerId: 'openrouter', free: false },
  { id: 'openrouter/anthropic/claude-haiku-4.5', model: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', providerId: 'openrouter', free: false, badge: '⚡' },
  // Google — Gemini 3
  { id: 'openrouter/google/gemini-3.1-pro-preview', model: 'google/gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', providerId: 'openrouter', free: false, badge: '🧠' },
  { id: 'openrouter/google/gemini-3.8-flash', model: 'google/gemini-3.8-flash', name: 'Gemini 3.8 Flash', providerId: 'openrouter', free: false, badge: '⚡' },
  // xAI / DeepSeek / Qwen
  { id: 'openrouter/x-ai/grok-4.7', model: 'x-ai/grok-4.7', name: 'Grok 4.7', providerId: 'openrouter', free: false },
  { id: 'openrouter/deepseek/deepseek-v4.1-flash', model: 'deepseek/deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', providerId: 'openrouter', free: false, badge: '⚡' },
  { id: 'openrouter/deepseek/deepseek-r1-0528', model: 'deepseek/deepseek-r1-0528', name: 'DeepSeek R1', providerId: 'openrouter', free: false, badge: '🧠' },
  // Open weights — currently free on OpenRouter
  { id: 'openrouter/qwen/qwen3.8-27b:free', model: 'qwen/qwen3.8-27b:free', name: 'Qwen 3.8 27B', providerId: 'openrouter', free: true },
  { id: 'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free', model: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra 550B', providerId: 'openrouter', free: true },
  { id: 'openrouter/google/gemma-4-31b-it:free', model: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B', providerId: 'openrouter', free: true },
];

function niceName(orName: string): string {
  let n = orName.split('/').pop() || orName;
  n = n.replace(/:free$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return n;
}

/** True for models whose reasoning phase consumes completion tokens. */
function isReasoning(m: ModelInfo): boolean {
  return m.noTemp === true || /^(openai\/gpt-5|openai\/o\d|deepseek\/deepseek-r1|google\/gemini-3|x-ai\/grok-4)/i.test(m.model);
}

/** Merge curated static entries into a live/cached list (static wins on id). */
function mergeStatic(live: ModelInfo[]): ModelInfo[] {
  const seen = new Set(live.map((m) => m.id));
  return [...STATIC, ...live.filter((m) => !seen.has(m.id))].slice(0, 320);
}

export async function refreshModels(): Promise<void> {
  let live: ModelInfo[] | null = null;

  try {
    const cached = localStorage.getItem(CACHE_LS);
    if (cached) {
      const { ts, list } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL && Array.isArray(list) && list.length) {
        live = list;
      }
    }
  } catch { /* refetch */ }

  // Only hit the network when the cache is stale — and always merge STATIC in,
  // so curated frontier models (GPT-5.5 etc.) are never hidden by an old cache.
  if (live) {
    models.length = 0;
    models.push(...mergeStatic(live));
    return;
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch('https://openrouter.ai/api/v1/models', { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return;
    const j: any = await res.json();
    const raw: any[] = j?.data || [];
    const list: ModelInfo[] = raw
      .filter((m) => {
        const mod = m.architecture?.output_modalities;
        return (!mod || mod.includes('text')) && !/moderation|embed|whisper|tts/i.test(m.id);
      })
      .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
      .slice(0, 250)
      .map((m) => ({
        id: `openrouter/${m.id}`,
        model: m.id,
        name: m.name || niceName(m.id),
        providerId: 'openrouter',
        free: String(m.id).endsWith(':free'),
        badge: String(m.id).endsWith(':free') ? 'FREE' : undefined,
        noTemp: Array.isArray(m.supported_parameters) && !m.supported_parameters.includes('temperature') ? true : undefined,
      }));
    if (list.length) {
      const merged = mergeStatic(list);
      models.length = 0;
      models.push(...merged);
      try { localStorage.setItem(CACHE_LS, JSON.stringify({ ts: Date.now(), list: merged })); } catch { /* noop */ }
    }
  } catch { /* keep static list */ }
}

export const models: ModelInfo[] = [...STATIC];

async function chat(p: ChatParams): Promise<string> {
  const key = getKey('openrouter');
  if (!key) {
    // fail fast with a clear, non-retried error instead of a pointless 401
    throw new McError('key', 'OpenRouter API key required', false);
  }
  // Reasoning models spend part of the completion budget on thinking — if the
  // cap is too small the answer comes back empty and looks like "nothing sent".
  const maxTokens = isReasoning(p.model) ? Math.max(p.maxTokens ?? 2048, 8192) : (p.maxTokens ?? 2048);
  return openaiChat({
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key,
    extraHeaders: {
      'HTTP-Referer': location.origin,
      'X-Title': 'ModelClash',
    },
    body: {
      model: p.model.model,
      messages: buildMessages(p.messages, p.systemPrompt),
      // GPT-5 / o-series reject temperature & top_p — omit entirely
      ...(p.model.noTemp ? {} : { temperature: p.temperature ?? 0.8 }),
      max_tokens: maxTokens,
    },
    onToken: p.onToken,
    signal: p.signal,
    onStatus: p.onStatus,
  });
}

export const openrouter: ChatProvider = {
  id: 'openrouter',
  name: 'OpenRouter',
  requiresKey: true,
  models,
  chat,
  refreshModels,
};
