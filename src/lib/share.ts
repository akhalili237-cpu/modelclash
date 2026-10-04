/* ── Shareable PNG battle report (canvas → blob → share/download) ──── */

export interface ReportData {
  aName: string;
  bName: string;
  aDelta: number | null;
  bDelta: number | null;
  prompt: string;
  result: 'a' | 'b' | 'tie' | 'bothBad';
  catLabel: string;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    } else cur = test;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    if (ctx.measureText(last).width > maxWidth) {
      while (last.length > 4 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

export async function shareBattleReport(d: ReportData): Promise<'shared' | 'downloaded'> {
  const W = 1200, H = 630;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  const font = (px: number, weight = '600') => `${weight} ${px}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;

  // background
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0a0a0f');
  g.addColorStop(0.55, '#151022');
  g.addColorStop(1, '#0d0a14');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // glow blobs
  const blob = (x: number, y: number, r: number, c: string) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `${c}44`);
    rg.addColorStop(1, '#0000');
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  blob(180, 140, 420, '#f97316');
  blob(1020, 520, 420, '#ec4899');

  // header
  ctx.fillStyle = '#f97316';
  ctx.font = font(44, '800');
  ctx.fillText('⚔️ ModelClash', 60, 92);
  ctx.fillStyle = '#a1a1aa';
  ctx.font = font(24, '500');
  ctx.fillText(`Blind battle · ${d.catLabel}`, 60, 132);

  // prompt
  ctx.fillStyle = '#e4e4e7';
  ctx.font = font(30, '600');
  const plines = wrap(ctx, d.prompt, W - 120, 2);
  plines.forEach((l, i) => ctx.fillText(l, 60, 200 + i * 42));

  // VS block
  const y = 420;
  const row = (x: number, name: string, delta: number | null, win: boolean) => {
    ctx.font = font(40, '800');
    ctx.fillStyle = win ? '#facc15' : '#e4e4e7';
    ctx.fillText(name, x, y);
    if (delta !== null) {
      ctx.font = font(30, '700');
      ctx.fillStyle = delta >= 0 ? '#4ade80' : '#f87171';
      ctx.fillText(`${delta >= 0 ? '+' : ''}${delta} ELO`, x, y + 46);
    }
  };
  row(60, d.aName.slice(0, 22), d.aDelta, d.result === 'a');
  ctx.font = font(56, '900');
  ctx.fillStyle = '#71717a';
  ctx.textAlign = 'center';
  ctx.fillText(d.result === 'tie' ? 'TIE' : d.result === 'bothBad' ? '—' : 'VS', W / 2, y);
  ctx.textAlign = 'left';
  ctx.textAlign = 'right';
  row(W - 60, d.bName.slice(0, 22), d.bDelta, d.result === 'b');
  ctx.textAlign = 'left';

  // crown for winner
  if (d.result === 'a' || d.result === 'b') {
    ctx.font = font(34);
    ctx.fillText('👑', d.result === 'a' ? 60 : W - 60 - ctx.measureText('👑').width, y - 52);
  }

  // footer
  ctx.fillStyle = '#52525b';
  ctx.font = font(22, '500');
  ctx.fillText('modelclash · free AI arena in your browser', 60, H - 48);

  const blob2 = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/png'));
  if (!blob2) return 'downloaded';
  const file = new File([blob2], 'modelclash-battle.png', { type: 'image/png' });

  // try native share, fall back to download
  const navAny = navigator as any;
  if (navAny.canShare?.({ files: [file] })) {
    try {
      await navAny.share({ files: [file], title: 'ModelClash battle report' });
      return 'shared';
    } catch { /* user cancelled → fall through to download */ }
  }
  const url = URL.createObjectURL(blob2);
  const a = document.createElement('a');
  a.href = url;
  a.download = `modelclash-battle-${Date.now()}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

export function exportMarkdown(title: string, body: string): void {
  const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^\w\u0600-\u06FF\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af -]+/g, '').slice(0, 40) || 'chat'}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
