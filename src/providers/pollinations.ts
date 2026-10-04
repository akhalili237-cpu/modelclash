import { McError, type ChatParams, type ChatProvider, type ModelInfo } from '../types';
import { openaiChat, buildMessages } from '../lib/sse';
import { getKey } from '../lib/keys';

/**
 * Tier 0 — Pollinations. Free, key-less, default channel.
 * POST https://text.pollinations.ai/openai  { model, messages, stream:true }
 * An Authorization header is ONLY sent when the user saved an optional key.
 *
 * ⚠ The anonymous tier only serves a small live catalog (currently openai-fast +
 * openai). Older static ids (llama, mistral, qwen-coder…) are gone and answer
 * 402/404 — they would look like "message never sends", so they are NOT listed.
 * If a picked Pollinations model turns out unavailable, chat() transparently
 * falls back to openai-fast so the user always gets an answer.
 */

/** Guaranteed-working keyless models (verified against the live anon tier). */
const GUARANTEED = ['openai-fast', 'openai'];
const FALLBACK_MODEL = 'openai-fast';

const NAMES: Record<string, string> = {
  'openai-fast': 'GPT-OSS 20B · fast',
  'openai': 'OpenAI · chat',
  'gemini': 'Gemini Flash',
};

function mk(model: string, i: number): ModelInfo {
  return {
    id: `pollinations/${model}`,
    model,
    name: NAMES[model] || model,
    providerId: 'pollinations',
    free: true,
    badge: i === 0 ? '⚡' : undefined,
  };
}

export const models: ModelInfo[] = GUARANTEED.map((m, i) => mk(m, i));

/** Live catalog refresh — REPLACE with models the current tier can actually use. */
export async function refreshModels(): Promise<void> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch('https://text.pollinations.ai/models', { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return;
    const j: any = await res.json();
    const list: any[] = Array.isArray(j) ? j : j?.data || [];
    if (!list.length) return;

    const seen = new Set<string>();
    const next: ModelInfo[] = [];
    // guaranteed models always stay selectable, openai-fast first
    for (const g of GUARANTEED) {
      seen.add(g);
      next.push(mk(g, next.length));
    }
    for (const it of list) {
      const id: string = it.name || it.id;
      if (!id || seen.has(id) || next.length >= 24) continue;
      seen.add(id);
      // strip hosting suffixes like "(OVH)" from descriptions
      const nice = String(it.description || it.name || id).replace(/\s*\([^)]*\)\s*$/, '').trim();
      next.push({
        ...mk(id, next.length),
        name: nice.length > 2 && nice.length < 40 ? nice : id,
      });
    }
    if (next.length) {
      models.length = 0;
      models.push(...next);
    }
  } catch { /* offline is fine — fallback list already there */ }
}

async function chat(p: ChatParams): Promise<string> {
  const tryModel = (model: string) =>
    openaiChat({
      url: 'https://text.pollinations.ai/openai',
      key: getKey('pollinations') || undefined,
      body: {
        model,
        messages: buildMessages(p.messages, p.systemPrompt),
        temperature: p.temperature ?? 0.8,
        max_tokens: p.maxTokens ?? 2048,
      },
      onToken: p.onToken,
      signal: p.signal,
      onStatus: p.onStatus,
    });

  try {
    const full = await tryModel(p.model.model);
    if (full.trim() || p.model.model === FALLBACK_MODEL) return full;
    // empty completion from a non-default model → try the default once
    throw new McError('none');
  } catch (e) {
    const isMc = e instanceof McError;
    if (isMc && (e.code === 'abort')) throw e;
    const hasUserKey = !!getKey('pollinations');
    // user's own Pollinations key rejected → surface it, don't mask with fallback
    if (isMc && e.code === 'key' && hasUserKey) {
      throw new McError('key', e.message, false);
    }
    // picked model unavailable/tier-blocked (401/402/403/404/5xx) or empty →
    // transparently retry on the guaranteed keyless model
    if (
      p.model.model !== FALLBACK_MODEL &&
      (!isMc || ['key', 'credits', 'forbidden', 'server', 'none', 'busy'].includes(e.code))
    ) {
      try {
        p.onStatus?.('fallback');
        const full = await tryModel(FALLBACK_MODEL);
        if (full.trim()) return full;
      } catch { /* fall through to the original error */ }
    }
    // on the keyless free tier, auth-ish failures mean rate-limited/blocked,
    // NOT "bad key" — and a 402 there is tier shortage, not paid credits
    if (isMc && ['key', 'credits', 'forbidden'].includes(e.code) && !hasUserKey) {
      throw new McError('busy', e.message);
    }
    throw e;
  }
}

export const pollinations: ChatProvider = {
  id: 'pollinations',
  name: 'Pollinations',
  requiresKey: false,
  models,
  chat,
  refreshModels,
};
