import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatInput } from '../components/ChatInput';
import { Btn, Card, Chip, PageHeader } from '../components/ui';
import { IconTrash, IconChevron, IconSearch } from '../components/icons';
import { useApp } from '../store/app';
import { useI18n } from '../i18n';
import {
  allImageModels, imageModelOf, generateImage, enhancePrompt, refreshImageModels,
  ASPECTS, type Aspect, type ImageModel,
} from '../providers/images';
import { K_GALLERY, loadList, saveList, uid, type GalleryItem } from '../lib/storage';
import { applyResult, loadElo, saveElo } from '../lib/elo';
import { getKey } from '../lib/keys';
import { cn } from '../lib/utils';

type PanelState = 'idle' | 'loading' | 'done' | 'error';

interface Panel {
  modelId: string;
  url: string;
  state: PanelState;
}

const IDEAS = [
  'a dragon made of glass',
  'cozy cyberpunk ramen shop',
  'sunset over ancient Persia',
  'astronaut painting a sunrise, oil style',
];

/* ------------------------- per-side image model picker ------------------------ */

function ImageModelPicker({
  value, onChange, exclude, hasGeminiKey,
}: {
  value: string;
  onChange: (id: string) => void;
  exclude: string;
  hasGeminiKey: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const eloMap = useMemo(() => loadElo(), [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allImageModels(hasGeminiKey).filter(
      (m) => m.id !== exclude && (!needle || m.name.toLowerCase().includes(needle) || m.model.includes(needle)),
    );
  }, [q, exclude, hasGeminiKey]);
  const current = imageModelOf(value);

  return (
    <div ref={boxRef} className="relative min-w-0 flex-1">
      <button
        onClick={() => { setOpen((o) => !o); setQ(''); }}
        className="flex w-full items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 text-start text-sm font-bold text-white hover:bg-white/5 transition-colors"
      >
        <span className="truncate">
          {current ? `${current.badge ? current.badge + ' ' : ''}${current.name}` : t('c.select') + '…'}
          {current && !current.free && !hasGeminiKey && current.provider === 'gemini-img' && (
            <span className="ms-1 opacity-70">🔒</span>
          )}
        </span>
        <IconChevron className={cn('w-3.5 h-3.5 shrink-0 text-zinc-500 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-40 mt-1.5 w-full min-w-[240px] overflow-hidden rounded-xl border border-line bg-panel shadow-2xl animate-fade-up">
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
            {list.map((m) => {
              const elo = eloMap[m.id]?.cats?.image?.r ?? 0;
              const locked = m.provider === 'gemini-img' && !hasGeminiKey;
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
                    {m.live && <span className="ms-1.5 rounded bg-emerald-900/60 px-1 py-0.5 text-[9px] font-bold text-emerald-300">LIVE</span>}
                    {locked && <span className="ms-1.5 opacity-60">🔒</span>}
                  </span>
                  {elo > 0 && <span className="shrink-0 font-mono text-[11px] text-zinc-500">{elo}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- download --------------------------------- */

async function downloadImage(url: string, name: string) {
  try {
    let href = url;
    if (!url.startsWith('data:')) {
      const res = await fetch(url);
      const blob = await res.blob();
      href = URL.createObjectURL(blob);
    }
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (href !== url) setTimeout(() => URL.revokeObjectURL(href), 10_000);
  } catch {
    window.open(url, '_blank');
  }
}

/* --------------------------------- the arena --------------------------------- */

export function ImageArena() {
  const { t } = useI18n();
  const { toast, bumpData } = useApp();
  const hasGeminiKey = !!getKey('gemini');
  const [tab, setTab] = useState<'arena' | 'gallery'>('arena');
  const [models, setModels] = useState<string[]>(['', '']);
  const [panels, setPanels] = useState<Panel[]>([
    { modelId: '', url: '', state: 'idle' },
    { modelId: '', url: '', state: 'idle' },
  ]);
  const [aspect, setAspect] = useState<Aspect>('1:1');
  const [prompt, setPrompt] = useState('');
  const [voted, setVoted] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const promptRef = useRef(prompt);
  promptRef.current = prompt;

  // live catalog + default pair
  useEffect(() => {
    refreshImageModels().then(() => {
      const pool = allImageModels(!!getKey('gemini'));
      setModels((cur) => {
        if (cur[0] && cur[1]) return cur;
        const live = pool.filter((m) => m.live);
        const pick = (a: ImageModel[], b: ImageModel[]) => b[0] || a[1] || a[0];
        const first = live[0] || pool[0];
        const second = pick(live.filter((m) => m.id !== first.id), pool.filter((m) => m.id !== first.id));
        return cur[0] && cur[1] ? cur : [first.id, second.id];
      });
    });
  }, []);

  useEffect(() => {
    loadList<GalleryItem>(K_GALLERY).then((l) => setGallery(l.sort((a, b) => b.ts - a.ts)));
  }, [bumpData]);

  useEffect(() => () => ctrlRef.current?.abort(), []);

  const setPanelModel = (idx: number, id: string) => {
    setModels((m) => m.map((x, i) => (i === idx ? id : x)));
    setPanels((ps) => ps.map((p, i) => (i === idx ? { ...p, modelId: id, url: '', state: 'idle' } : p)));
    setVoted(null);
  };

  const generate = (text: string) => {
    const p = text.trim();
    if (!p) return;
    const ims = models.map((id) => imageModelOf(id)).filter(Boolean) as ImageModel[];
    if (ims.length < 2) return;
    if (ims.some((m) => m.provider === 'gemini-img' && !hasGeminiKey)) {
      toast(t('image.needGemini'), 'info');
      return;
    }
    setPrompt(p);
    setVoted(null);
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setPanels(ims.map((im) => ({ modelId: im.id, url: '', state: 'loading' as const })));

    ims.forEach((im, i) => {
      generateImage(im, p, aspect, ctrl.signal)
        .then(({ url }) => {
          setPanels((ps) => ps.map((x, j) => (j === i ? { ...x, url, state: 'done' } : x)));
          const item: GalleryItem = { id: uid(), prompt: p, engine: im.id, url, ts: Date.now() };
          loadList<GalleryItem>(K_GALLERY).then((list) => {
            saveList(K_GALLERY, [...list, item].slice(-300));
            setGallery((g) => [item, ...g].slice(0, 300));
          });
        })
        .catch(() => setPanels((ps) => ps.map((x, j) => (j === i ? { ...x, state: 'error' } : x))));
    });
  };

  const vote = (side: number) => {
    if (voted) return;
    const winner = panels[side]?.modelId;
    const loser = panels[1 - side]?.modelId;
    if (!winner || !loser || winner === loser) return;
    setVoted(winner);
    const store = loadElo();
    applyResult(store, winner, loser, 'a', 'image');
    saveElo(store);
    toast(t('battle.eloUpdated'), 'ok');
    bumpData();
  };

  const removeItem = (id: string) => {
    const next = gallery.filter((g) => g.id !== id);
    setGallery(next);
    saveList(K_GALLERY, next);
  };

  const busy = panels.some((p) => p.state === 'loading');

  return (
    <div>
      <PageHeader
        title={t('image.title')}
        desc={t('image.desc')}
        right={
          <div className="flex gap-2">
            <Chip active={tab === 'arena'} onClick={() => setTab('arena')}>⚔️ Arena</Chip>
            <Chip active={tab === 'gallery'} onClick={() => setTab('gallery')}>🖼 {t('image.gallery')} ({gallery.length})</Chip>
          </div>
        }
      />

      {tab === 'arena' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {panels.map((p, i) => (
              <Card key={i} className="overflow-hidden" glow={!!voted && voted === p.modelId}>
                <div className="flex items-center justify-between gap-2 border-b border-line px-2 py-1.5">
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="ps-1.5 text-xs font-black text-zinc-500">{i === 0 ? 'A' : 'B'}</span>
                    <ImageModelPicker
                      value={models[i]}
                      onChange={(id) => setPanelModel(i, id)}
                      exclude={models[1 - i] || ''}
                      hasGeminiKey={hasGeminiKey}
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 pe-1.5">
                    {p.state === 'done' && p.url && (
                      <button
                        onClick={() => downloadImage(p.url, `modelclash-${p.modelId.split('/').pop()}.png`)}
                        className="rounded-lg px-2 py-1 text-[11px] font-bold text-zinc-400 hover:bg-white/5 hover:text-white"
                        title={t('c.download')}
                      >
                        ⬇ {t('c.download')}
                      </button>
                    )}
                    {voted === p.modelId && <span className="text-xs font-bold text-gold">👑 {t('c.winner')}</span>}
                  </div>
                </div>
                <div className={cn('relative aspect-square bg-[#0b0b12]', busy && 'animate-pulse')}>
                  {p.state === 'idle' && (
                    <div className="flex h-full items-center justify-center text-4xl opacity-30">🖼</div>
                  )}
                  {p.state === 'loading' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-accent" />
                      <span className="text-xs text-zinc-500">{t('image.generating')}</span>
                    </div>
                  )}
                  {p.state === 'error' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                      <span className="text-2xl">💨</span>
                      <span className="text-xs text-rose-300 px-4">{t('err.server')}</span>
                      <Btn variant="outline" onClick={() => generate(promptRef.current)}>{t('c.retry')}</Btn>
                    </div>
                  )}
                  {p.state === 'done' && p.url && (
                    <img src={p.url} alt={prompt} className="h-full w-full object-cover" loading="lazy" />
                  )}
                </div>
                {p.state === 'done' && (
                  <div className="p-3">
                    <Btn
                      variant={voted === p.modelId ? 'gold' : 'ghost'}
                      className="w-full"
                      onClick={() => vote(i)}
                      disabled={!!voted}
                    >
                      {voted ? (voted === p.modelId ? '👑' : '·') : '👍'} {t('battle.voting')}
                    </Btn>
                  </div>
                )}
              </Card>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {ASPECTS.map((a) => (
                <Chip key={a.k} active={aspect === a.k} onClick={() => setAspect(a.k)}>{a.k}</Chip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {IDEAS.map((idea) => (
                <Chip key={idea} onClick={() => setPrompt(idea)}>{idea}</Chip>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <ChatInput
                  onSend={generate}
                  busy={busy}
                  onStop={() => ctrlRef.current?.abort()}
                  placeholder={`${t('image.generate')} — ${t('c.prompt')}…`}
                />
              </div>
              <Btn variant="ghost" className="py-3.5" onClick={() => setPrompt(enhancePrompt(prompt || 'a dreamlike landscape'))} title={t('image.enhance')}>
                ✨ <span className="hidden sm:inline">{t('image.enhance')}</span>
              </Btn>
            </div>
          </div>
        </>
      )}

      {tab === 'gallery' && (
        <div>
          {gallery.length === 0 ? (
            <Card className="p-10 text-center text-sm text-zinc-500">{t('lb.noData')}</Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {gallery.map((g) => (
                <div key={g.id} className="group relative overflow-hidden rounded-xl border border-line">
                  <img
                    src={g.url}
                    alt={g.prompt}
                    className="aspect-square w-full cursor-pointer object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                    onClick={() => setLightbox(g)}
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-6">
                    <span className="truncate text-[10px] text-zinc-300">{imageModelOf(g.engine)?.name || g.engine} · {g.prompt}</span>
                    <button onClick={() => removeItem(g.id)} className="shrink-0 rounded p-1 text-zinc-500 hover:text-rose-400">
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/85 p-6" onClick={() => setLightbox(null)}>
          <div className="max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.prompt} className="max-h-[75vh] rounded-xl" />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="truncate text-sm text-zinc-300" dir="auto">{lightbox.prompt}</span>
              <div className="flex shrink-0 gap-2">
                <Btn variant="outline" onClick={() => downloadImage(lightbox.url, 'modelclash.png')}>{t('c.download')}</Btn>
                <Btn variant="ghost" onClick={() => setLightbox(null)}>{t('c.close')}</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
