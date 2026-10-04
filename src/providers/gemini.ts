import { McError, type ChatParams, type ChatProvider, type ModelInfo } from '../types';
import { readSSE, httpErr, netErr, abortErr } from '../lib/sse';
import { getKey } from '../lib/keys';

/**
 * Tier 2 — Google Gemini (BYOK).
 * POST …/v1beta/models/{model}:streamGenerateContent?alt=sse&key=KEY
 * body: { contents, systemInstruction, generationConfig }
 * parse: candidates[0].content.parts[].text
 *
 * Thinking models (2.5/3.x) spend maxOutputTokens on thoughts first — a small
 * cap makes them return NOTHING. We therefore always raise the budget.
 */

const STATIC: ModelInfo[] = [
  { id: 'gemini/gemini-3-pro-preview', model: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', providerId: 'gemini', free: false, badge: '🧠' },
  { id: 'gemini/gemini-2.5-pro', model: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', providerId: 'gemini', free: false, badge: '🧠' },
  { id: 'gemini/gemini-2.5-flash', model: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', providerId: 'gemini', free: false, badge: '⚡' },
  { id: 'gemini/gemini-2.5-flash-lite', model: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', providerId: 'gemini', free: false },
  { id: 'gemini/gemini-2.0-flash', model: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', providerId: 'gemini', free: false },
];

export const models: ModelInfo[] = [...STATIC];

function extract(j: any): string {
  const parts = j?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p: any) => p?.text || '').join('');
}

async function chat(p: ChatParams): Promise<string> {
  const key = getKey('gemini');
  if (!key) {
    // fail fast — an empty key in the URL would 400 with a confusing message
    throw new McError('key', 'Google Gemini API key required', false);
  }
  const sys = (p.systemPrompt || '').trim();
  const contents = p.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .filter((m) => !(m.role === 'assistant' && !m.content.trim()))
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.model.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;

  // thinking tokens count toward maxOutputTokens on 2.5/3.x — never allow a tiny cap
  const budget = Math.max(p.maxTokens ?? 2048, 8192);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {}),
      generationConfig: {
        temperature: p.temperature ?? 0.8,
        maxOutputTokens: budget,
      },
    }),
    signal: p.signal,
  }).catch((e) => { throw netErr(e, p.signal); });

  if (!res.ok) throw await httpErr(res);

  let text = '';
  try {
    await readSSE(res, (data) => {
      try {
        const chunk = extract(JSON.parse(data));
        if (chunk) {
          text += chunk;
          p.onToken(chunk);
        }
      } catch { /* partial */ }
    });
  } catch (e) {
    if (p.signal?.aborted) throw abortErr(p.signal);
    throw new McError('stream', String((e as Error)?.message || e));
  }
  return text;
}

export const gemini: ChatProvider = {
  id: 'gemini',
  name: 'Google Gemini',
  requiresKey: true,
  models,
  chat,
};
