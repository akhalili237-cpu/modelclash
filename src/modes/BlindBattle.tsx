import { useEffect, useRef, useState } from 'react';
import { ModelPicker } from '../components/ModelPicker';
import { ChatInput } from '../components/ChatInput';
import { Markdown } from '../components/Markdown';
import { ErrorBanner } from '../components/ErrorBanner';
import { Btn, Card, Chip, PageHeader, Spinner } from '../components/ui';
import { IconDice, IconShare } from '../components/icons';
import { useApp } from '../store/app';
import { useI18n } from '../i18n';
import { getModel, providerOf, resolveModel, usableModels } from '../providers/registry';
import { chatWithResilience } from '../lib/chat';
import { McError, type Cat, CATS } from '../types';
import { K_BATTLES, loadList, saveList, uid, type BattleRec } from '../lib/storage';
import { applyResult, loadElo, saveElo } from '../lib/elo';
import { shareBattleReport } from '../lib/share';
import { shuffle } from '../lib/utils';

type Phase = 'setup' | 'run' | 'reveal';
type Side = 'a' | 'b';
type SideState = 'streaming' | 'done' | 'error';

interface BattleState {
  aId: string;
  bId: string;
  prompt: string;
  cat: Cat;
  texts: Record<Side, string>;
  states: Record<Side, SideState>;
  err: McError | null;
  deltas: { a: number | null; b: number | null };
  result: 'a' | 'b' | 'tie' | 'bothBad' | null;
}

export function BlindBattle() {
  const { t } = useI18n();
  const { settings, sysPrompt, toast, bumpData } = useApp();
  const [phase, setPhase] = useState<Phase>('setup');
  const [aId, setAId] = useState(() => '');
  const [bId, setBId] = useState(() => '');
  const [cat, setCat] = useState<Cat>('general');
  const [battle, setBattle] = useState<BattleState | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

  useEffect(() => () => ctrlRef.current?.abort(), []);

  const randomPair = () => {
    // only models that can actually run right now (keyless or key already saved)
    const list = usableModels(settings.customModels);
    if (list.length < 2) return;
    const ids = shuffle(list.map((m) => m.id));
    setAId(ids[0]);
    setBId(ids[1]);
  };

  const begin = (prompt: string) => {
    if (!aId || !bId || aId === bId) { toast(t('battle.needTwo'), 'err'); return; }
    const state: BattleState = {
      aId, bId, prompt, cat,
      texts: { a: '', b: '' },
      states: { a: 'streaming', b: 'streaming' },
      err: null,
      deltas: { a: null, b: null },
      result: null,
    };
    setBattle(state);
    setPhase('run');

    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    busyRef.current = true;

    const runSide = async (side: Side) => {
      const model = resolveModel(side === 'a' ? aId : bId, settings.customModels);
      if (model.id !== (side === 'a' ? aId : bId)) {
        (side === 'a' ? setAId : setBId)(model.id);
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
          onToken: (tok) => setBattle((s) => s && ({ ...s, texts: { ...s.texts, [side]: s.texts[side] + tok } })),
        });
        setBattle((s) => s && ({ ...s, states: { ...s.states, [side]: 'done' } }));
      } catch (e) {
        const mcE = e instanceof McError ? e : new McError('server');
        if (mcE.code === 'abort') {
          setBattle((s) => s && ({ ...s, states: { ...s.states, [side]: s.texts[side] ? 'done' : 'error' } }));
        } else {
          setBattle((s) => s && ({ ...s, states: { ...s.states, [side]: 'error' } }));
        }
      }
    };
    void runSide('a');
    void runSide('b');
  };

  const vote = (result: 'a' | 'b' | 'tie' | 'bothBad') => {
    if (!battle) return;
    const store = loadElo();
    let deltas: { a: number | null; b: number | null } = { a: null, b: null };
    if (result === 'a' || result === 'b' || result === 'tie') {
      const beforeA = store[battle.aId]?.global.r ?? 1200;
      const beforeB = store[battle.bId]?.global.r ?? 1200;
      const [dA] = applyResult(store, battle.aId, battle.bId, result === 'a' ? 'a' : result === 'b' ? 'b' : 'tie', battle.cat);
      saveElo(store);
      deltas = { a: (store[battle.aId]?.global.r ?? beforeA) - beforeA, b: (store[battle.bId]?.global.r ?? beforeB) - beforeB };
      toast(t('battle.eloUpdated'), 'ok');
    }
    const rec: BattleRec = {
      id: uid(),
      ts: Date.now(),
      cat: battle.cat,
      prompt: battle.prompt,
      a: { id: battle.aId, name: getModel(battle.aId)?.name || battle.aId, delta: deltas.a },
      b: { id: battle.bId, name: getModel(battle.bId)?.name || battle.bId, delta: deltas.b },
      result,
    };
    loadList<BattleRec>(K_BATTLES).then((list) => {
      list.push(rec);
      saveList(K_BATTLES, list.slice(-200));
      bumpData();
    });
    setBattle({ ...battle, deltas, result });
    setPhase('reveal');
  };

  const bothDone = battle && battle.states.a !== 'streaming' && battle.states.b !== 'streaming';

  const doShare = async () => {
    if (!battle?.result) return;
    const kind = await shareBattleReport({
      aName: getModel(battle.aId)?.name || battle.aId,
      bName: getModel(battle.bId)?.name || battle.bId,
      aDelta: battle.deltas.a,
      bDelta: battle.deltas.b,
      prompt: battle.prompt,
      result: battle.result,
      catLabel: t(`cat.${battle.cat}`),
    });
    if (kind === 'downloaded') toast(t('share.saved'), 'ok');
  };

  return (
    <div>
      <PageHeader title={t('battle.title')} desc={t('battle.desc')} />

      {phase === 'setup' && (
        <Card className="mx-auto max-w-2xl p-5">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-end gap-3">
            <ModelPicker label={t('battle.modelA')} value={aId} onChange={setAId} exclude={bId ? [bId] : []} />
            <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-panel2 border border-line font-black text-sm text-zinc-500">{t('c.vs')}</div>
            <ModelPicker label={t('battle.modelB')} value={bId} onChange={setBId} exclude={aId ? [aId] : []} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Btn variant="outline" onClick={randomPair}><IconDice className="w-4 h-4" />{t('battle.random')}</Btn>
          </div>
          <div className="mt-5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{t('c.category')}</div>
            <div className="flex flex-wrap gap-2">
              {CATS.filter((c) => c !== 'image').map((c) => (
                <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{t(`cat.${c}`)}</Chip>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <ChatInput onSend={begin} placeholder={`${t('battle.begin')} — ${t('c.prompt')}…`} large />
          </div>
        </Card>
      )}

      {phase !== 'setup' && battle && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(['a', 'b'] as Side[]).map((side) => {
              const name = phase === 'reveal' ? getModel(side === 'a' ? battle.aId : battle.bId)?.name : t(`battle.model${side.toUpperCase()}`);
              const st = battle.states[side];
              const txt = battle.texts[side];
              return (
                <Card key={side} className="flex min-h-52 flex-col p-4" glow={phase === 'reveal' && battle.result === side}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2 font-bold text-white">
                      {'🎭'}
                      {name}
                    </span>
                    {phase === 'reveal' && battle.deltas[side] !== null && (
                      <span className={`rounded-lg px-2 py-0.5 font-mono text-xs font-bold ${battle.deltas[side]! >= 0 ? 'bg-emerald-900/50 text-emerald-300' : 'bg-rose-900/50 text-rose-300'}`}>
                        {battle.deltas[side]! >= 0 ? '+' : ''}{battle.deltas[side]} ELO
                      </span>
                    )}
                    {st === 'streaming' && phase === 'run' && <Spinner className="w-4 h-4" />}
                    {st === 'error' && <span className="text-xs font-bold text-rose-400">{t('c.error')}</span>}
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[50vh]">
                    {txt ? <Markdown text={txt} /> : st === 'streaming' ? <span className="text-sm text-zinc-500 streaming">{t('c.thinking')}</span> : <span className="text-sm text-zinc-600">—</span>}
                  </div>
                </Card>
              );
            })}
          </div>

          {phase === 'run' && (
            <div className="mt-4 space-y-3">
              <ErrorBanner error={battle.err} onClose={() => setBattle({ ...battle, err: null })} />
              <Card className="p-4">
                {bothDone ? (
                  battle.states.a === 'error' && battle.states.b === 'error' && !battle.texts.a && !battle.texts.b ? (
                    <div className="text-center">
                      <div className="mb-3 text-sm text-rose-200">{t('err.server')}</div>
                      <Btn variant="gold" onClick={() => { setBattle(null); setPhase('setup'); }}>{t('battle.newBattle')}</Btn>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-3 text-center font-bold text-white">{t('battle.voting')}</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Btn variant="primary" onClick={() => vote('a')}>👈 {t('battle.aBetter')}</Btn>
                        <Btn variant="primary" onClick={() => vote('b')}>{t('battle.bBetter')} 👉</Btn>
                        <Btn variant="ghost" onClick={() => vote('tie')}>{t('c.tie')}</Btn>
                        <Btn variant="ghost" onClick={() => vote('bothBad')}>{t('c.bothBad')}</Btn>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-xs text-zinc-500" dir="auto">“{battle.prompt}”</span>
                    <Btn variant="danger" onClick={() => ctrlRef.current?.abort()}>{t('c.stop')}</Btn>
                  </div>
                )}
              </Card>
            </div>
          )}

          {phase === 'reveal' && (
            <Card className="mt-4 p-5 text-center animate-pop">
              <div className="text-3xl">{battle.result === 'tie' ? '🤝' : battle.result === 'bothBad' ? '💨' : '👑'}</div>
              <div className="mt-2 font-extrabold text-white">
                {battle.result === 'a' || battle.result === 'b'
                  ? `${t('c.winner')}: ${getModel(battle.result === 'a' ? battle.aId : battle.bId)?.name}`
                  : battle.result === 'tie' ? t('c.tie') : t('c.bothBad')}
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Btn variant="primary" onClick={doShare}><IconShare className="w-4 h-4" />{t('battle.report')}</Btn>
                <Btn variant="gold" onClick={() => { setBattle(null); setPhase('setup'); }}>{t('battle.newBattle')}</Btn>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
