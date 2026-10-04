/** tiny classnames helper */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function eloColor(r: number): string {
  if (r >= 1300) return 'text-gold';
  if (r >= 1250) return 'text-emerald-400';
  if (r >= 1200) return 'text-zinc-300';
  if (r >= 1150) return 'text-orange-400';
  return 'text-rose-400';
}

export function medal(i: number): string {
  return ['🥇', '🥈', '🥉'][i] || `#${i + 1}`;
}
