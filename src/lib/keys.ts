/* ── localStorage-backed app settings & API keys ───────────────────── */

export interface Keys {
  pollinations?: string;
  openrouter?: string;
  groq?: string;
  gemini?: string;
}

const KEYS_LS = 'mc.keys';

export function getKeys(): Keys {
  try { return JSON.parse(localStorage.getItem(KEYS_LS) || '{}'); } catch { return {}; }
}
export function getKey(provider: string): string {
  return getKeys()[provider as keyof Keys] || '';
}
export function setKey(provider: string, v: string): void {
  const k = getKeys();
  if (v) k[provider as keyof Keys] = v;
  else delete k[provider as keyof Keys];
  try { localStorage.setItem(KEYS_LS, JSON.stringify(k)); } catch { /* noop */ }
}

/* ── misc settings (model picks per mode, install later, …) ────────── */

export function lsGet(key: string, fallback = ''): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
export function lsSet(key: string, v: string): void {
  try { localStorage.setItem(key, v); } catch { /* noop */ }
}
export function lsDel(key: string): void {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}
