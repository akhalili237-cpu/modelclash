import { useEffect, useMemo, useState } from 'react';
import { Btn, Card, Chip, PageHeader } from '../components/ui';
import { useApp } from '../store/app';
import { useI18n } from '../i18n';
import { allModelsPlus } from '../providers/registry';
import { imageModelOf } from '../providers/images';
import { loadElo, recFor, resetElo, totalGames, totalVotes, START_RATING } from '../lib/elo';
import { K_BATTLES, K_CHATS, K_GALLERY, loadList } from '../lib/storage';
import { CATS, type Cat, type EloStats } from '../types';
import { cn, medal } from '../lib/utils';

type SortKey = 'elo' | 'games' | 'winRate';

export function Leaderboard() {
  const { t } = useI18n();
  const { dataVersion, toast, bumpData } = useApp();
  const [cat, setCat] = useState<Cat>('general');
  const [sort, setSort] = useState<SortKey>('elo');
  const [stats, setStats] = useState<{ battles: number; chats: number; images: number }>({ battles: 0, chats: 0, images: 0 });

  useEffect(() => {
    Promise.all([loadList(K_BATTLES), loadList(K_CHATS), loadList(K_GALLERY)]).then(([b, c, g]) => {
      setStats({ battles: b.length, chats: c.length, images: g.length });
    });
  }, [dataVersion]);

  const eloMap = useMemo(() => loadElo(), [dataVersion]);
  const nameOf = useMemo(() => {
    const map = new Map(allModelsPlus('').map((m) => [m.id, m.name]));
    return (id: string) => map.get(id) || imageModelOf(id)?.name || id.split('/').pop() || id;
  }, [dataVersion]);

  const rows = useMemo(() => {
    const out: { id: string; name: string; r: number; g: number; wr: number }[] = [];
    for (const [id, s] of Object.entries(eloMap as Record<string, EloStats>)) {
      const rec = recFor(s, cat);
      if (rec.g === 0) continue;
      out.push({
        id,
        name: nameOf(id),
        r: rec.r,
        g: rec.g,
        wr: rec.g ? Math.round((rec.w / rec.g) * 100) : 0,
      });
    }
    out.sort((a, b) =>
      sort === 'elo' ? b.r - a.r : sort === 'games' ? b.g - a.g : b.wr - a.wr,
    );
    return out;
  }, [eloMap, cat, sort, nameOf]);

  const doReset = () => {
    if (!confirm(t('c.confirm'))) return;
    resetElo();
    toast(t('lb.reset'), 'ok');
    bumpData();
  };

  return (
    <div>
      <PageHeader
        title={t('lb.title')}
        desc={t('lb.desc')}
        right={<Btn variant="danger" onClick={doReset}>{t('lb.reset')}</Btn>}
      />

      {/* stats cards */}
      <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('settings.battles'), value: stats.battles, icon: '⚔️' },
          { label: t('settings.votes'), value: totalVotes(eloMap), icon: '🗳️' },
          { label: t('settings.images'), value: stats.images, icon: '🖼️' },
          { label: t('settings.chats'), value: stats.chats, icon: '💬' },
        ].map((c) => (
          <Card key={c.label} className="p-4">
            <div className="text-xl">{c.icon}</div>
            <div className="mt-1 text-2xl font-extrabold text-white">{c.value}</div>
            <div className="text-xs text-zinc-500">{c.label}</div>
          </Card>
        ))}
      </div>

      {/* category tabs */}
      <div className="mb-3 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{t(`cat.${c}`)}</Chip>
        ))}
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-3xl">🕊️</div>
            <p className="mt-2 text-sm text-zinc-500">{t('lb.noData')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-start text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3 text-start font-semibold">#</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('lb.model')}</th>
                  <th
                    onClick={() => setSort('elo')}
                    className={cn('cursor-pointer px-4 py-3 text-end font-semibold hover:text-white', sort === 'elo' && 'text-orange-300')}
                  >
                    {t('lb.elo')} ↕
                  </th>
                  <th
                    onClick={() => setSort('games')}
                    className={cn('hidden cursor-pointer px-4 py-3 text-end font-semibold hover:text-white sm:table-cell', sort === 'games' && 'text-orange-300')}
                  >
                    {t('lb.games')} ↕
                  </th>
                  <th
                    onClick={() => setSort('winRate')}
                    className={cn('cursor-pointer px-4 py-3 text-end font-semibold hover:text-white', sort === 'winRate' && 'text-orange-300')}
                  >
                    {t('lb.winRate')} ↕
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} className="border-b border-line/50 last:border-0 hover:bg-panel2/50">
                    <td className="px-4 py-3 text-zinc-500">{i < 3 ? medal(i) : i + 1}</td>
                    <td className="max-w-52 truncate px-4 py-3 font-semibold text-zinc-100">{row.name}</td>
                    <td className="px-4 py-3 text-end">
                      <span className={cn(
                        'rounded-lg px-2 py-1 font-mono font-bold',
                        row.r > START_RATING ? 'bg-emerald-900/40 text-emerald-300' : row.r < START_RATING ? 'bg-rose-900/40 text-rose-300' : 'text-zinc-300',
                      )}>
                        {row.r}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-end font-mono text-zinc-400 sm:table-cell">{row.g}</td>
                    <td className="px-4 py-3 text-end font-mono text-zinc-400">{row.wr}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <div className="mt-3 text-center text-[11px] text-zinc-600">
        {t('settings.battles')}: {totalGames(eloMap)}
      </div>
    </div>
  );
}
