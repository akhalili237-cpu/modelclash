import { get, set, del } from 'idb-keyval';

/* ── generic helpers ───────────────────────────────────────────────── */

export async function loadList<T>(key: string): Promise<T[]> {
  try { return (await get<T[]>(key)) || []; } catch { return []; }
}
export async function saveList<T>(key: string, list: T[]): Promise<void> {
  try { await set(key, list); } catch { /* storage full / private mode */ }
}
export async function loadObj<T>(key: string): Promise<T | null> {
  try { return (await get<T>(key)) ?? null; } catch { return null; }
}
export async function saveObj<T>(key: string, v: T): Promise<void> {
  try { await set(key, v); } catch { /* noop */ }
}
export async function dropKey(key: string): Promise<void> {
  try { await del(key); } catch { /* noop */ }
}

/* ── keys ──────────────────────────────────────────────────────────── */

export const K_CHATS = 'mc.chats';
export const K_BATTLES = 'mc.battles';
export const K_GALLERY = 'mc.gallery';
export const K_PROMPTS = 'mc.prompts';
export const K_TOURNAMENT = 'mc.tournament';
export const K_HANDOFF = 'mc.handoff';

/* ── shapes ────────────────────────────────────────────────────────── */

export interface ChatSession {
  id: string;
  title: string;
  modelId: string;
  messages: { role: 'user' | 'assistant'; content: string; modelId?: string }[];
  ts: number;
}

export interface BattleRec {
  id: string;
  ts: number;
  cat: string;
  prompt: string;
  a: { id: string; name: string; delta: number | null };
  b: { id: string; name: string; delta: number | null };
  result: 'a' | 'b' | 'tie' | 'bothBad';
}

export interface GalleryItem {
  id: string;
  prompt: string;
  engine: string;
  url: string;
  ts: number;
}

export interface SavedPrompt {
  id: string;
  text: string;
  ts: number;
}

export interface Handoff {
  messages: { role: 'user' | 'assistant'; content: string }[];
  modelId: string;
  ts: number;
}

/* ── ids ───────────────────────────────────────────────────────────── */

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
