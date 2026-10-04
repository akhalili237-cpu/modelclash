import React, { useEffect, useMemo, useRef, useState } from 'react';
import { allModelsPlus, providerLabel } from '../providers/registry';
import type { ModelInfo } from '../types';
import { cn } from '../lib/utils';
import { loadElo } from '../lib/elo';
import { IconChevron, IconSearch } from './icons';
import { useApp } from '../store/app';
import { useI18n } from '../i18n';

export function ModelPicker({
  value, onChange, label, exclude = [], className,
}: {
  value: string;
  onChange: (id: string) => void;
  label?: string;
  exclude?: string[];
  className?: string;
}) {
  const { settings, dataVersion } = useApp();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  // dataVersion: bumped when live catalogs finish refreshing → re-read lists
  const models = useMemo(() => allModelsPlus(settings.customModels), [settings.customModels, dataVersion]);
  const current = models.find((m) => m.id === value);
  const eloMap = useMemo(() => loadElo(), [open, models]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = models.filter(
      (m) =>
        !exclude.includes(m.id) &&
        (!needle || m.name.toLowerCase().includes(needle) || m.model.toLowerCase().includes(needle) || m.providerId.includes(needle)),
    );
    const map = new Map<string, ModelInfo[]>();
    for (const m of filtered) {
      const arr = map.get(m.providerId) || [];
      arr.push(m);
      map.set(m.providerId, arr);
    }
    return [...map.entries()];
  }, [models, q, exclude]);

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      {label && <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>}
      <button
        onClick={() => { setOpen((o) => !o); setQ(''); }}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-panel2 px-3 py-2 text-sm',
          'hover:border-zinc-600 transition-colors text-start',
        )}
      >
        <span className="truncate font-semibold text-zinc-100">
          {current ? `${current.badge ? current.badge + ' ' : ''}${current.name}` : t('c.select') + '…'}
        </span>
        <IconChevron className={cn('w-4 h-4 shrink-0 text-zinc-500 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-40 mt-1.5 w-full min-w-[260px] overflow-hidden rounded-xl border border-line bg-panel shadow-2xl animate-fade-up">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <IconSearch className="w-4 h-4 text-zinc-500" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`${t('c.models')}…`}
              className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
              dir="ltr"
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5">
            {grouped.length === 0 && <div className="px-3 py-4 text-center text-xs text-zinc-500">—</div>}
            {grouped.map(([pid, list]) => (
              <div key={pid} className="mb-1">
                <div className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                  {providerLabel(pid)}
                </div>
                {list.map((m) => {
                  const elo = eloMap[m.id]?.global?.r ?? 0;
                  // paid OpenRouter models need account credits — mark them so a
                  // zero-credit key holder knows why a PRO pick may refuse
                  const isPaid = m.providerId === 'openrouter' && m.free !== true && m.badge !== '✎';
                  return (
                    <button
                      key={m.id}
                      onClick={() => { onChange(m.id); setOpen(false); }}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-start text-sm transition-colors',
                        m.id === value ? 'bg-accent/15 text-orange-200' : 'text-zinc-300 hover:bg-panel2',
                      )}
                    >
                      <span className="truncate">
                        {m.badge && <span className="me-1">{m.badge}</span>}
                        {m.name}
                        {isPaid && <span className="ms-1.5 rounded bg-amber-900/60 px-1 py-0.5 text-[9px] font-bold text-amber-300">PRO</span>}
                        {m.free && <span className="ms-1.5 rounded bg-emerald-900/60 px-1 py-0.5 text-[9px] font-bold text-emerald-300">FREE</span>}
                        {m.note && <span className="ms-1.5 text-[10px] text-zinc-500">{m.note}</span>}
                      </span>
                      {elo > 0 && <span className="shrink-0 font-mono text-[11px] text-zinc-500">{elo}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
