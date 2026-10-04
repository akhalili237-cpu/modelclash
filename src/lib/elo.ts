import type { Cat, EloRec, EloStats, EloStore } from '../types';

/**
 * ELO engine — K=32, start 1200.
 * Ratings are kept per category AND globally. Every battle updates both.
 * Tournament finals run with K×2 (champion bonus).
 */
export const START_RATING = 1200;
export const K_FACTOR = 32;

const LS_KEY = 'mc.elo.v1';

export function loadElo(): EloStore {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as EloStore) : {};
  } catch { return {}; }
}

export function saveElo(s: EloStore): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

export function resetElo(): void {
  try { localStorage.removeItem(LS_KEY); } catch { /* noop */ }
}

function emptyRec(): EloRec {
  return { r: START_RATING, g: 0, w: 0, l: 0, d: 0 };
}

export function ensureStats(store: EloStore, id: string): EloStats {
  if (!store[id]) store[id] = { global: emptyRec(), cats: {} };
  return store[id];
}

export function recFor(stats: EloStats, cat?: Cat): EloRec {
  if (!cat || cat === 'general') return stats.global;
  return stats.cats[cat] || emptyRec();
}

function recForMut(stats: EloStats, cat?: Cat): EloRec {
  if (!cat || cat === 'general') return stats.global;
  if (!stats.cats[cat]) stats.cats[cat] = emptyRec();
  return stats.cats[cat];
}

export function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

export type BattleOutcome = 'a' | 'b' | 'tie';

/**
 * Apply a result. Mutates the store; call saveElo() afterwards.
 * Returns the rating deltas [deltaA, deltaB] (rounded).
 */
export function applyResult(
  store: EloStore,
  aId: string,
  bId: string,
  outcome: BattleOutcome,
  cat: Cat,
  k: number = K_FACTOR,
): [number, number] {
  const sa = ensureStats(store, aId);
  const sb = ensureStats(store, bId);
  const ra = recForMut(sa, cat);
  const rb = recForMut(sb, cat);
  const ga = recForMut(sa, 'general');
  const gb = recForMut(sb, 'general');

  const ea = expectedScore(ra.r, rb.r);
  const saOut = outcome === 'a' ? 1 : outcome === 'b' ? 0 : 0.5;

  const dCat = Math.round(k * (saOut - ea));
  const dGlobal = Math.round(k * (saOut - expectedScore(ga.r, gb.r)));

  ra.r += dCat; ra.g++; if (outcome === 'a') ra.w++; else if (outcome === 'b') ra.l++; else ra.d++;
  rb.r -= dCat; rb.g++; if (outcome === 'b') rb.w++; else if (outcome === 'a') rb.l++; else rb.d++;

  ga.r += dGlobal; ga.g++; if (outcome === 'a') ga.w++; else if (outcome === 'b') ga.l++; else ga.d++;
  gb.r -= dGlobal; gb.g++; if (outcome === 'b') gb.w++; else if (outcome === 'a') gb.l++; else gb.d++;

  return [dCat, -dCat];
}

/** Top n model ids by rating in a category (only models that have played). */
export function topModels(store: EloStore, cat: Cat, n: number): string[] {
  return Object.entries(store)
    .map(([id, s]) => ({ id, r: recFor(s, cat).r, g: s.global.g }))
    .filter((x) => x.g > 0)
    .sort((x, y) => y.r - x.r)
    .slice(0, n)
    .map((x) => x.id);
}

export function totalGames(store: EloStore): number {
  let n = 0;
  for (const s of Object.values(store)) {
    // global games count each battle once per side; a battle touches 2 models
    n += s.global.g;
  }
  return Math.floor(n / 2);
}

export function totalVotes(store: EloStore): number {
  let n = 0;
  for (const s of Object.values(store)) n += s.global.g;
  return n;
}
