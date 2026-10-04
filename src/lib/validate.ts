import type { Keys } from './keys';

/* ── Live API-key validation ──────────────────────────────────────────
 * Settings calls these the moment a key is pasted, so the user learns
 * immediately whether the key is truly valid — instead of discovering a
 * broken key later through a chat error. Also reports OpenRouter credits.
 */

export interface KeyCheck {
  /** 'checking' is a UI-only pending state (validateKey never returns it) */
  status: 'ok' | 'bad' | 'checking' | 'unknown';
  /** extra info, e.g. "$4.20 ⛁" or "free tier" */
  info?: string;
}

export const VALIDATABLE = ['openrouter', 'groq', 'gemini'] as const;

export async function validateKey(provider: string, key: string): Promise<KeyCheck> {
  const k = (key || '').trim();
  if (!k) return { status: 'unknown' };

  try {
    if (provider === 'openrouter') {
      // GET /auth/key — returns label, usage, limit, is_free_tier
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${k}` },
      });
      if (res.status === 401) return { status: 'bad' };
      if (!res.ok) return { status: 'unknown' }; // endpoint hiccup ≠ invalid key
      const j: any = await res.json().catch(() => null);
      const d = j?.data || {};
      const parts: string[] = [];
      if (typeof d.limit === 'number') {
        const left = Math.max(0, d.limit - (d.usage || 0));
        parts.push(`$${left.toFixed(2)} ⛁`);
      } else if (d.is_free_tier) {
        parts.push('free tier');
      }
      return { status: 'ok', info: parts.join(' · ') };
    }

    if (provider === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${k}` },
      });
      if (res.status === 401) return { status: 'bad' };
      if (!res.ok) return { status: 'unknown' };
      return { status: 'ok' };
    }

    if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(k)}`,
      );
      if (res.status === 400 || res.status === 403) {
        // 400 can also be a bad request — only call it "bad" when the body
        // clearly blames the key
        try {
          const j: any = await res.clone().json();
          if (/api[_ ]?key/i.test(j?.error?.message || '')) return { status: 'bad' };
        } catch { /* not json */ }
        if (res.status === 403) return { status: 'bad' };
        return { status: 'unknown' };
      }
      if (!res.ok) return { status: 'unknown' };
      return { status: 'ok' };
    }

    // pollinations — no public check endpoint; the app works keyless anyway
    return { status: 'unknown' };
  } catch {
    // network failure ≠ invalid key — stay neutral
    return { status: 'unknown' };
  }
}

/** Validate every saved key once (used when Settings opens). */
export async function validateSaved(keys: Keys): Promise<Record<string, KeyCheck>> {
  const out: Record<string, KeyCheck> = {};
  await Promise.all(
    VALIDATABLE.map(async (pid) => {
      const v = (keys[pid as keyof Keys] || '').trim();
      out[pid] = v ? await validateKey(pid, v) : { status: 'unknown' };
    }),
  );
  return out;
}
