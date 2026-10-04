/**
 * Image generation engines.
 *
 * Tier 0 — Pollinations (free, key-less):
 *   GET https://image.pollinations.ai/prompt/{prompt}?model=…&nologo=true
 *   Live catalog: GET https://image.pollinations.ai/models (anonymous tier
 *   currently exposes e.g. "sana"; flux/turbo/kontext/nanobanana appear for
 *   token tiers — we keep them selectable with retry).
 *
 * Tier 2 — Google Gemini (BYOK, professional quality):
 *   - Imagen 4:      POST /v1beta/models/imagen-4.0-…-generate-001:predict
 *                    → predictions[0].bytesBase64Encoded
 *   - Nano Banana:   POST /v1beta/models/gemini-2.5-flash-image:generateContent
 *                    → candidates[0].content.parts[].inlineData
 */

import { getKey } from '../lib/keys';

export interface ImageModel {
  id: string;              // unique key for ELO + UI, e.g. "pollinations-image/flux"
  provider: 'pollinations-image' | 'gemini-img';
  model: string;           // pollinations model name | gemini model id
  name: string;
  badge?: string;
  free: boolean;
  live?: boolean;          // confirmed available by the live catalog
}

export type Aspect = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';

export const ASPECTS: { k: Aspect; w: number; h: number }[] = [
  { k: '1:1', w: 1024, h: 1024 },
  { k: '4:3', w: 1280, h: 960 },
  { k: '3:4', w: 960, h: 1280 },
  { k: '16:9', w: 1280, h: 720 },
  { k: '9:16', w: 720, h: 1280 },
];

export function aspectOf(k: Aspect) {
  return ASPECTS.find((a) => a.k === k) || ASPECTS[0];
}

/** Known Pollinations image engines. Order = default preference. */
const POLL_FALLBACK: Omit<ImageModel, 'id' | 'provider'>[] = [
  { model: 'flux', name: 'Flux · quality', badge: '🎨', free: true },
  { model: 'sana', name: 'Sana · fast', badge: '⚡', free: true },
  { model: 'turbo', name: 'Turbo · fast', badge: '⚡', free: true },
  { model: 'nanobanana', name: 'Nano Banana', badge: '🍌', free: true },
  { model: 'kontext', name: 'Flux Kontext', badge: '🎨', free: true },
  { model: 'seedream', name: 'Seedream 4', badge: '🎨', free: true },
];

/** Gemini BYOK image engines — top-tier quality. */
export const GEMINI_IMAGE_MODELS: ImageModel[] = [
  { id: 'gemini-img/imagen-4.0-generate-001', provider: 'gemini-img', model: 'imagen-4.0-generate-001', name: 'Imagen 4 Ultra', badge: '💎', free: false },
  { id: 'gemini-img/imagen-4.0-fast-generate-001', provider: 'gemini-img', model: 'imagen-4.0-fast-generate-001', name: 'Imagen 4 Fast', badge: '⚡', free: false },
  { id: 'gemini-img/gemini-2.5-flash-image', provider: 'gemini-img', model: 'gemini-2.5-flash-image', name: 'Nano Banana · Gemini', badge: '🍌', free: false },
];

const CACHE_LS = 'mc.img.models';
const CACHE_TTL = 30 * 60 * 1000;

let pollModels: ImageModel[] = POLL_FALLBACK.map((m) => ({
  ...m,
  id: `pollinations-image/${m.model}`,
  provider: 'pollinations-image' as const,
}));

/** Fetch the live Pollinations image catalog; live models are ordered first. */
export async function refreshImageModels(): Promise<void> {
  try {
    const cached = localStorage.getItem(CACHE_LS);
    if (cached) {
      const { ts, list } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL && Array.isArray(list) && list.length) {
        pollModels = list;
        return;
      }
    }
  } catch { /* refetch */ }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch('https://image.pollinations.ai/models', { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return;
    const raw: string[] = await res.json();
    if (!Array.isArray(raw) || !raw.length) return;
    const known = new Map(pollModels.map((m) => [m.model, m]));
    const live: ImageModel[] = raw.map((name) => {
      const k = known.get(name);
      return {
        id: `pollinations-image/${name}`,
        provider: 'pollinations-image' as const,
        model: name,
        name: k?.name || prettyImgName(name),
        badge: k?.badge,
        free: true,
        live: true,
      };
    });
    // keep known-but-not-live engines after the confirmed ones
    const rest = pollModels.filter((m) => !raw.includes(m.model)).map((m) => ({ ...m, live: false }));
    pollModels = [...live, ...rest];
    try { localStorage.setItem(CACHE_LS, JSON.stringify({ ts: Date.now(), list: pollModels })); } catch { /* noop */ }
  } catch { /* keep fallback */ }
}

function prettyImgName(s: string): string {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function pollImageModels(): ImageModel[] {
  return pollModels;
}

/** All image models (Pollinations + Gemini BYOK). */
export function allImageModels(hasGeminiKey: boolean): ImageModel[] {
  return [...pollModels, ...GEMINI_IMAGE_MODELS.map((m) => ({ ...m, free: hasGeminiKey ? m.free : false }))];
}

export function imageModelOf(id: string): ImageModel | undefined {
  return pollModels.find((m) => m.id === id)
    || GEMINI_IMAGE_MODELS.find((m) => m.id === id);
}

/* ------------------------------- Pollinations ------------------------------ */

export function buildImageUrl(
  prompt: string,
  model: string,
  seed: number,
  w = 1024,
  h = 1024,
  enhance = true,
): string {
  const p = encodeURIComponent(prompt.slice(0, 1500));
  const params = new URLSearchParams({
    model, nologo: 'true', width: String(w), height: String(h), seed: String(seed),
  });
  if (enhance) params.set('enhance', 'true');
  return `https://image.pollinations.ai/prompt/${p}?${params.toString()}`;
}

/** Preload so the UI can show a spinner and detect failures. 90 s cap. */
export function preloadImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => {
      img.src = '';
      reject(new DOMException('image timeout', 'TimeoutError'));
    }, 90_000);
    const onAbort = () => {
      clearTimeout(timer);
      img.src = '';
      reject(new DOMException('aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    img.onload = () => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); resolve(img); };
    img.onerror = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new Error('image failed'));
    };
    img.src = url;
  });
}

/* --------------------------------- Gemini ---------------------------------- */

function base64ToDataUrl(b64: string, mime = 'image/png'): string {
  return `data:${mime};base64,${b64}`;
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Imagen 4 — :predict endpoint, returns base64 PNG. */
async function genImagen(model: string, prompt: string, aspect: Aspect, signal?: AbortSignal): Promise<string> {
  const key = getKey('gemini');
  const res = await fetch(`${GEMINI_BASE}/${encodeURIComponent(model)}:predict?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: prompt.slice(0, 2000) }],
      parameters: { sampleCount: 1, aspectRatio: aspect },
    }),
    signal,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`gemini ${res.status}: ${txt.slice(0, 200)}`);
  }
  const j: any = await res.json();
  const b64 = j?.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('gemini: empty prediction');
  return base64ToDataUrl(b64, j?.predictions?.[0]?.mimeType || 'image/png');
}

/** Nano Banana (gemini-2.5-flash-image) — :generateContent, inline image. */
async function genNanoBanana(model: string, prompt: string, aspect: Aspect, signal?: AbortSignal): Promise<string> {
  const key = getKey('gemini');
  const res = await fetch(`${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt.slice(0, 2000) }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } },
    }),
    signal,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`gemini ${res.status}: ${txt.slice(0, 200)}`);
  }
  const j: any = await res.json();
  const parts = j?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find((p: any) => p?.inlineData?.data);
  if (!imgPart) throw new Error('gemini: no image in response');
  return base64ToDataUrl(imgPart.inlineData.data, imgPart.inlineData.mimeType || 'image/png');
}

/* --------------------------------- Unified --------------------------------- */

/**
 * Generate one image for a model. Pollinations retries ×3 with fresh seeds
 * (free tier throws transient 402/5xx); Gemini retries once on 429/503.
 */
export async function generateImage(
  im: ImageModel,
  prompt: string,
  aspect: Aspect,
  signal?: AbortSignal,
): Promise<{ url: string; seed: number }> {
  if (im.provider === 'gemini-img') {
    let lastErr: unknown;
    for (let i = 0; i < 2; i++) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
      try {
        if (im.model.startsWith('imagen-')) {
          return { url: await genImagen(im.model, prompt, aspect, signal), seed: 0 };
        }
        return { url: await genNanoBanana(im.model, prompt, aspect, signal), seed: 0 };
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') throw e;
        lastErr = e;
        const retriable = /gemini (429|500|503)/.test(String((e as Error)?.message));
        if (!retriable) break;
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
    throw lastErr ?? new Error('image failed');
  }

  const { w, h } = aspectOf(aspect);
  let lastErr: unknown = new Error('image failed');
  for (let i = 0; i < 3; i++) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    if (i > 0) await new Promise((r) => setTimeout(r, 4000));
    const seed = Math.floor(Math.random() * 1_000_000);
    try {
      const url = buildImageUrl(prompt, im.model, seed, w, h);
      await preloadImage(url, signal);
      return { url, seed };
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') throw e;
      lastErr = e;
    }
  }
  throw lastErr;
}

/** Prompt enhancer — appends professional style flourishes. */
const STYLES = [
  'highly detailed, dramatic lighting, 4k, sharp focus',
  'cinematic composition, volumetric light, film grain, 35mm',
  'vibrant colors, soft shadows, artstation trending, masterpiece',
  'watercolor style, textured paper, delicate strokes',
  'isometric 3d render, pastel palette, soft studio light, octane render',
  'retro poster art, bold shapes, limited palette, clean composition',
];
export function enhancePrompt(prompt: string): string {
  const s = STYLES[Math.floor(Math.random() * STYLES.length)];
  return prompt.trim().replace(/[.,\s]+$/, '') + ', ' + s;
}
