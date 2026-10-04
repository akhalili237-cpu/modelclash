import { McError } from '../types';

/* ── SSE streaming reader ──────────────────────────────────────────── */

/** Reads an OpenAI-style SSE body and hands every `data:` payload to onData. */
export async function readSSE(res: Response, onData: (data: string) => void): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) throw new McError('stream', 'no response body');
  const dec = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line || line.startsWith(':')) continue;
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') {
            if (data === '[DONE]') return;
            continue;
          }
          onData(data);
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }
}

/* ── Error mapping ─────────────────────────────────────────────────── */

export async function httpErr(res: Response): Promise<McError> {
  let detail = '';
  try {
    const j: any = await res.json();
    detail = j?.error?.message || j?.message || '';
  } catch { /* not json */ }
  // ⚠ 402/403 are NOT key-format problems — collapsing them into "key error"
  // made users with a VALID key believe it was wrong:
  //   401 invalid key · 402 valid key, insufficient paid credits
  //   403 provider refusal (region/moderation) · 400+"api key" = Gemini-style bad key
  if (res.status === 401) return new McError('key', detail, false);
  if (res.status === 402) return new McError('credits', detail, false);
  if (res.status === 403) return new McError('forbidden', detail, false);
  if (res.status === 400 && /api[_ ]?key|unregistered/i.test(detail)) return new McError('key', detail, false);
  if (res.status === 429 || res.status === 408) return new McError('busy', detail);
  if (res.status === 400 || res.status === 404) {
    // deterministic failures (unknown model, bad params) — retrying only wastes 10 s
    return new McError('server', detail || `HTTP ${res.status}`, false);
  }
  if (res.status >= 500) return new McError('server', detail);
  return new McError('server', detail || `HTTP ${res.status}`, false);
}

export function netErr(e: unknown, signal?: AbortSignal): McError {
  if (signal?.aborted) return new McError('abort');
  const msg = (e as Error)?.message || String(e);
  return new McError('network', msg);
}

export function abortErr(signal?: AbortSignal): McError {
  return new McError(signal?.aborted ? 'abort' : 'stream');
}

/* ── Shared message builder ────────────────────────────────────────── */

export function buildMessages(
  messages: { role: string; content: string }[],
  systemPrompt?: string,
): { role: string; content: string }[] {
  const out: { role: string; content: string }[] = [];
  const sys = (systemPrompt || '').trim();
  if (sys) out.push({ role: 'system', content: sys });
  for (const m of messages) {
    if (m.role === 'system') continue;
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    if (m.role === 'assistant' && !m.content.trim()) continue;
    out.push({ role: m.role, content: m.content });
  }
  return out;
}

/* ── OpenAI-compatible streaming chat (used by 4 providers) ────────── */

export interface OpenAIChatOpts {
  url: string;
  key?: string;
  extraHeaders?: Record<string, string>;
  body: Record<string, any>;
  onToken: (t: string) => void;
  signal?: AbortSignal;
  onStatus?: (s: string) => void;
  /** extract text from a non-standard SSE payload (e.g. Gemini style) */
  extract?: (j: any) => string;
}

/**
 * Streams a chat completion. Resilience baked in:
 *  - mid-stream failure after tokens → one silent non-stream retry
 *  - never emits Authorization header when no key is set
 */
export async function openaiChat(o: OpenAIChatOpts): Promise<string> {
  const doFetch = (stream: boolean, bodyOverride?: Record<string, any>) =>
    fetch(o.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(o.key ? { Authorization: `Bearer ${o.key}` } : {}),
        ...(o.extraHeaders || {}),
      },
      body: JSON.stringify({ ...bodyOverride ?? o.body, stream }),
      signal: o.signal,
    });

  let res: Response;
  let body: Record<string, any> = { ...o.body };
  try {
    res = await doFetch(true);
  } catch (e) {
    throw netErr(e, o.signal);
  }

  // Some models reject params others accept (GPT-5 / o-series refuse temperature &
  // top_p; some backends want max_completion_tokens instead of max_tokens).
  // On a 400 that names a parameter, sanitize once and retry transparently.
  if (res.status === 400) {
    const detail = (await res.clone().text().catch(() => '')) || '';
    const patched: Record<string, any> = { ...body };
    let changed = false;
    if (/\btemperature\b|unsupported value.*temperature/i.test(detail) && 'temperature' in patched) {
      delete patched.temperature;
      delete patched.top_p;
      changed = true;
    }
    if (/\bmax_tokens\b|max_completion_tokens/i.test(detail) && 'max_tokens' in patched) {
      patched.max_completion_tokens = patched.max_tokens;
      delete patched.max_tokens;
      changed = true;
    }
    if (changed) {
      body = patched;
      try {
        res = await doFetch(true, body);
      } catch (e) {
        throw netErr(e, o.signal);
      }
    }
  }
  if (!res.ok) throw await httpErr(res);

  const extract = o.extract || ((j: any) => j?.choices?.[0]?.delta?.content ?? j?.choices?.[0]?.message?.content ?? '');

  let text = '';
  try {
    await readSSE(res, (data) => {
      try {
        const chunk = extract(JSON.parse(data));
        if (chunk) {
          text += chunk;
          o.onToken(chunk);
        }
      } catch { /* partial json line — ignore */ }
    });
  } catch (e) {
    if (o.signal?.aborted) throw abortErr(o.signal);
    // stream broke mid-way — fall back to a single non-stream request
    if (!text) {
      o.onStatus?.('fallback');
      const res2 = await doFetch(false, body).catch((e2) => { throw netErr(e2, o.signal); });
      if (!res2.ok) throw await httpErr(res2);
      const j: any = await res2.json().catch(() => null);
      const t = j ? (extract(j) || j?.choices?.[0]?.message?.content || '') : '';
      if (t) {
        text += t;
        o.onToken(t);
      }
    }
  }

  // some providers ignore stream:true and return plain JSON
  if (!text && res.headers.get('content-type')?.includes('application/json')) {
    try {
      const j: any = await res.clone().json();
      const t = extract(j) || j?.choices?.[0]?.message?.content || '';
      if (t) {
        text += t;
        o.onToken(t);
      }
    } catch { /* noop */ }
  }
  return text;
}
