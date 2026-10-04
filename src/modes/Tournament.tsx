import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatInput } from '../components/ChatInput';
import { Markdown } from '../components/Markdown';
import { ErrorBanner } from '../components/ErrorBanner';
import { Btn, Card, Chip, PageHeader, Spinner } from '../components/ui';
import { IconCheck, IconCrown, IconTrophy } from '../components/icons';
import { useApp } from '../store/app';
import { useI18n } from '../i18n';
import { allModelsPlus, getModel, providerOf, resolveModel, usableModels } from '../providers/registry';
import { chatWithResilience } from '../lib/chat';
import { McError, type Cat, CATS } from '../types';
import { K_TOURNAMENT, loadObj, saveObj, dropKey } from '../lib/storage';
import { applyResult, loadElo, recFor, saveElo, START_RATING } from '../lib/elo';
import { cn, shuffle } from '../lib/utils';

interface Match {
  a: string;
  b: string;
  winner?: string;
}
interface TournState {
  size: 4 | 8;
  cat: Cat;
  rounds: Match[][];   // rounds[i] = list of matches; winner advances
  prompt: string;      // last used prompt
  createdTs: number;
}

const K2 = 64; // champion bonus: double K on the final

export function Tournament() {
  const { t } = useI18n();
  const { settings, sysPrompt, toast, bumpData } = useApp();
  const [stage, setStage] = useState<'setup' | 'bracket' | 'champion'>('setup');
  const [size, setSize] = useState<4 | 8>(4);
  const [cat, setCat] = useState<Cat>('general');
  const [picked, setPicked] = useState<string[]>([]);
  const [tourn, setTourn] = useState<TournState | null>(null);
  const [texts, setTexts] = useState<{ a: string; b: string }>({ a: '', b: '' });
  const [states, setStates] = useState<{ a: 'wait' | 'run' | 'done' | 'err'; b: 'wait' | 'run' | 'done' | 'err' }>({ a: 'wait', b: 'wait' });
  const [err, setErr] = useState<McError | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const models = useMemo(() => allModelsPlus(settings.customModels), [settings.customModels]);
  const eloMap = useMemo(() => loadElo(), [stage, picked, models]);

  /* restore an unfinished tournament */
  useEffect(() => {
    loadObj<TournState>(K_TOURNAMENT).then((s) => {
      if (s && !s.rounds[s.rounds.length - 1]?.every((m) => m.winner)) {
        setTourn(s);
        setSize(s.size);
        setCat(s.cat);
        setStage('bracket');
      }
    });
  }, []);

  const persist = useCallback((s: TournState | null) => {
    if (s) saveObj(K_TOURNAMENT, s);
    else dropKey(K_TOURNAMENT);
  }, []);

  const autoPick = () => {
    // rank only models that can actually run (keyless or key already saved)
    const pool = usableModels(settings.customModels);
    const ranked = [...pool].sort((x, y) => (recFor(eloMap[y.id] || { global: { r: START_RATING, g: 0, w: 0, l: 0, d: 0 }, cats: {} }, cat).r) - (recFor(eloMap[x.id] || { global: { r: START_RATING, g: 0, w: 0, l: 0, d: 0 }, cats: {} }, cat).r));
    setPicked(ranked.slice(0, size).map((m) => m.id));
  };

  const start = () => {
    if (picked.length < 4) { toast(t('tourn.needModels'), 'err'); return; }
    const parts = shuffle(picked).slice(0, size);
    const first: Match[] = [];
    for (let i = 0; i < parts.length; i += 2) first.push({ a: parts[i], b: parts[i + 1] });
    const s: TournState = { size, cat, rounds: [first], prompt: '', createdTs: Date.now() };
    setTourn(s);
    persist(s);
    setStage('bracket');
  };

  const abandon = () => {
    ctrlRef.current?.abort();
    setTourn(null);
    persist(null);
    setStage('setup');
    setPicked([]);
  };

  const currentMatch = useMemo(() => {
    if (!tourn) return null;
    for (const round of tourn.rounds) {
      const m = round.find((x) => !x.winner);
      if (m) return m;
    }
    return null;
  }, [tourn]);

  const isFinal = useMemo(() => {
    if (!tourn || !currentMatch) return false;
    const lastRound = tourn.rounds[tourn.rounds.length - 1];
    return lastRound.length === 1 && lastRound[0] === currentMatch;
  }, [tourn, currentMatch]);

  const runMatch = (prompt: string) => {
    if (!tourn || !currentMatch) return;
    setTexts({ a: '', b: '' });
    setStates({ a: 'run', b: 'run' });
    setErr(null);
    const s: TournState = { ...tourn, prompt };
    setTourn(s);
    persist(s);

    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    const runSide = async (side: 'a' | 'b') => {
      const model = resolveModel(side === 'a' ? currentMatch.a : currentMatch.b, settings.customModels);
      if (model.id !== (side === 'a' ? currentMatch.a : currentMatch.b)) {
        // heal the bracket so names/votes resolve to the model that actually ran
        setTourn((tt) => tt && ({
          ...tt,
          rounds: tt.rounds.map((r) => r.map((m) => (
            m.a === currentMatch.a && m.b === currentMatch.b
              ? (side === 'a' ? { ...m, a: model.id } : { ...m, b: model.id })
              : m
          ))),
        }));
        toast(t('c.autoSwitch').replace('{m}', model.name), 'info');
      }
      try {
        await chatWithResilience(providerOf(model.id), {
          model,
          messages: [{ role: 'user', content: prompt }],
          systemPrompt: sysPrompt,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          signal: ctrl.signal,
          onToken: (tok) => setTexts((tx) => ({ ...tx, [side]: tx[side] + tok })),
        });
        setStates((st) => ({ ...st, [side]: 'done' }));
      } catch (e) {
        const mcE = e instanceof McError ? e : new McError('server');
        if (mcE.code === 'abort') setStates((st) => ({ ...st, [side]: 'done' }));
        else setStates((st) => ({ ...st, [side]: 'err' }));
      }
    };
    void runSide('a');
    void runSide('b');
  };

  const pickWinner = (side: 'a' | 'b') => {
    if (!tourn || !currentMatch) return;
    const winner = side === 'a' ? currentMatch.a : currentMatch.b;
    const loser = side === 'a' ? currentMatch.b : currentMatch.a;

    // ELO: final counts double (champion bonus ×2)
    const store = loadElo();
    applyResult(store, currentMatch.a, currentMatch.b, side === 'a' ? 'a' : 'b', cat, isFinal ? K2 : 32);
    saveElo(store);

    const rounds = tourn.rounds.map((r) => r.map((m) => (m === currentMatch ? { ...m, winner } : m)));
    const lastRound = rounds[rounds.length - 1];
    const allDone = lastRound.every((m) => m.winner);

    if (allDone) {
      if (lastRound.length === 1) {
        // tournament complete
        persist(null);
        setTourn({ ...tourn, rounds });
        setStage('champion');
        bumpData();
        toast(`👑 ${getModel(winner)?.name || winner} — ${t('tourn.bonus')}`, 'ok');
        return;
      }
      // build next round from winners in order
      const next: Match[] = [];
      for (let i = 0; i < lastRound.length; i += 2) {
        next.push({ a: lastRound[i].winner!, b: lastRound[i + 1].winner! });
      }
      const s: TournState = { ...tourn, rounds: [...rounds, next] };
      setTourn(s);
      persist(s);
    } else {
      const s: TournState = { ...tourn, rounds };
      setTourn(s);
      persist(s);
    }
    // reset panels for the next match
    setTexts({ a: '', b: '' });
    setStates({ a: 'wait', b: 'wait' });
    void loser;
  };

  const champion = useMemo(() => {
    if (stage !== 'champion' || !tourn) return null;
    const last = tourn.rounds[tourn.rounds.length - 1];
    return last[last.length - 1]?.winner || null;
  }, [stage, tourn]);

  /* ── UI ── */
  if (stage === 'setup') {
    return (
      <div>
        <PageHeader title={t('tourn.title')} desc={t('tourn.desc')} />
        <Card className="mx-auto max-w-2xl p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{t('tourn.size')}</div>
              <div className="flex gap-2">
                {([4, 8] as const).map((s) => (
                  <Chip key={s} active={size === s} onClick={() => { setSize(s); setPicked((p) => p.slice(0, s)); }}>{s}</Chip>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{t('c.category')}</div>
              <div className="flex flex-wrap gap-2">
                {CATS.filter((c) => c !== 'image').map((c) => (
                  <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{t(`cat.${c}`)}</Chip>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm font-bold text-zinc-300">{picked.length}/{size} {t('c.models')}</div>
            <Btn variant="outline" onClick={autoPick}>{t('tourn.autoPick')}</Btn>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pe-1">
            {models.map((m) => {
              const on = picked.includes(m.id);
              const elo = recFor(eloMap[m.id] || { global: { r: START_RATING, g: 0, w: 0, l: 0, d: 0 }, cats: {} }, cat);
              return (
                <button
                  key={m.id}
                  onClick={() => setPicked((p) => on ? p.filter((x) => x !== m.id) : p.length < size ? [...p, m.id] : p)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition-colors',
                    on ? 'border-accent/60 bg-accent/10' : 'border-line bg-panel2/60 hover:border-zinc-600',
                  )}
                >
                  <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border', on ? 'border-accent bg-accent text-white' : 'border-zinc-600')}>
                    {on && <IconCheck className="w-3 h-3" />}
                  </span>
                  <span className="flex-1 truncate text-sm text-zinc-200">{m.badge ? m.badge + ' ' : ''}{m.name}</span>
                  {elo.g > 0 && <span className="font-mono text-[11px] text-zinc-500">{elo.r}</span>}
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <Btn variant="primary" className="w-full py-3" onClick={start} disabled={picked.length < 4}>
              <IconTrophy className="w-5 h-5" />{t('tourn.start')}
            </Btn>
          </div>
        </Card>
      </div>
    );
  }

  if (stage === 'champion' && champion) {
    return (
      <div>
        <PageHeader title={t('tourn.title')} />
        <Card className="relative mx-auto max-w-xl overflow-hidden p-10 text-center" glow>
          {Array.from({ length: 14 }).map((_, i) => (
            <span
              key={i}
              className="absolute top-0 h-2 w-2 animate-[fall_2.4s_linear_infinite] rounded-sm"
              style={{
                left: `${(i * 7 + 4) % 100}%`,
                background: ['#f97316', '#ec4899', '#facc15', '#4ade80'][i % 4],
                animationDelay: `${i * 0.18}s`,
                animationDuration: `${2 + (i % 3)}s`,
              }}
            />
          ))}
          <div className="animate-pop text-6xl">🏆</div>
          <div className="mt-3 text-xs font-bold uppercase tracking-[.3em] text-gold">{t('tourn.champion')}</div>
          <div className="mt-2 text-2xl font-extrabold text-white">{getModel(champion)?.name || champion}</div>
          <div className="mt-1 text-sm text-zinc-500">{t('tourn.bonus')}</div>
          <div className="mt-6 flex justify-center gap-2">
            <Btn variant="gold" onClick={abandon}><IconCrown className="w-4 h-4" />{t('tourn.newT')}</Btn>
          </div>
        </Card>
      </div>
    );
  }

  /* bracket stage */
  return (
    <div>
      <PageHeader
        title={t('tourn.title')}
        right={<Btn variant="danger" onClick={abandon}>{t('tourn.abandon')}</Btn>}
      />

      {/* bracket map */}
      <div className="mb-4 flex gap-3 overflow-x-auto pb-2">
        {tourn?.rounds.map((round, ri) => (
          <div key={ri} className="min-w-40 flex-1">
            <div className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              {roundName(tourn.size, ri, tourn.rounds.length, t)}
            </div>
            <div className="space-y-1.5">
              {round.map((m, mi) => {
                const active = currentMatch === m;
                return (
                  <div
                    key={mi}
                    className={cn(
                      'rounded-lg border px-2 py-1.5 text-[11px] leading-tight',
                      active ? 'border-accent/70 bg-accent/10 text-white' : 'border-line bg-panel2/60 text-zinc-400',
                    )}
                  >
                    <div className="truncate">{getModel(m.a)?.name || m.a}</div>
                    <div className="truncate">{getModel(m.b)?.name || m.b}</div>
                    {m.winner && <div className="mt-0.5 font-bold text-gold">👑 {getModel(m.winner)?.name || m.winner}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {currentMatch ? (
        <>
          <Card className="mb-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-white">
                🥊 {getModel(currentMatch.a)?.name} <span className="mx-1 text-zinc-500">{t('c.vs')}</span> {getModel(currentMatch.b)?.name}
              </div>
              {isFinal && <span className="rounded-full bg-gold/15 border border-gold/40 px-2.5 py-0.5 text-[11px] font-bold text-gold">{t('tourn.final')} · {t('tourn.bonus')}</span>}
            </div>
          </Card>

          {states.a === 'wait' && states.b === 'wait' ? (
            <Card className="p-4">
              <ChatInput onSend={runMatch} placeholder={`${t('tourn.round')} — ${t('c.prompt')}…`} large />
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(['a', 'b'] as const).map((side) => (
                  <Card key={side} className="flex min-h-48 flex-col p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-bold text-white">{getModel(side === 'a' ? currentMatch.a : currentMatch.b)?.name}</span>
                      {states[side] === 'run' && <Spinner className="w-4 h-4" />}
                      {states[side] === 'err' && <span className="text-xs font-bold text-rose-400">{t('c.error')}</span>}
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[46vh]">
                      {texts[side] ? <Markdown text={texts[side]} /> : <span className="text-sm text-zinc-500 streaming">{t('c.thinking')}</span>}
                    </div>
                  </Card>
                ))}
              </div>
              {(states.a !== 'run' || texts.a) && (states.b !== 'run' || texts.b) ? (
                <Card className="mt-3 p-4">
                  <div className="mb-2 text-center text-sm font-bold text-zinc-300">{t('tourn.round')} — {t('c.winner')}?</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Btn variant="primary" onClick={() => pickWinner('a')}>👈 {getModel(currentMatch.a)?.name}</Btn>
                    <Btn variant="primary" onClick={() => pickWinner('b')}>{getModel(currentMatch.b)?.name} 👉</Btn>
                  </div>
                </Card>
              ) : (
                <div className="mt-3 flex justify-end">
                  <Btn variant="danger" onClick={() => ctrlRef.current?.abort()}>{t('c.stop')}</Btn>
                </div>
              )}
              <div className="mt-2"><ErrorBanner error={err} onClose={() => setErr(null)} /></div>
            </>
          )}
        </>
      ) : (
        <Card className="p-8 text-center text-sm text-zinc-400">…</Card>
      )}
    </div>
  );
}

function roundName(size: 4 | 8, roundIdx: number, totalRounds: number, t: (k: string) => string): string {
  const roundsFromEnd = totalRounds - 1 - roundIdx;
  if (roundsFromEnd === 0) return t('tourn.final');
  if (roundsFromEnd === 1) return t('tourn.semis');
  if (roundsFromEnd === 2) return t('tourn.quarters');
  return `${t('tourn.round')} ${roundIdx + 1}`;
}
