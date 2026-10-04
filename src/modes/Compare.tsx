import { useEffect, useRef, useState } from 'react';
import { ModelPicker } from '../components/ModelPicker';
import { ChatInput } from '../components/ChatInput';
import { Markdown } from '../components/Markdown';
import { Btn, Card, PageHeader, Spinner } from '../components/ui';
import { IconPlus, IconX } from '../components/icons';
import { useApp } from '../store/app';
import { useI18n } from '../i18n';
import { getModel, providerOf, resolveModel } from '../providers/registry';
import { chatWithResilience } from '../lib/chat';
import { McError, type ChatMessage } from '../types';
import { K_HANDOFF, saveObj, type Handoff } from '../lib/storage';
import { lsGet, lsSet } from '../lib/keys';

type SlotState = 'idle' | 'run' | 'done' | 'err';

interface Slot {
  modelId: string;
  text: string;
  state: SlotState;
}

const MAX_SLOTS = 4;

export function Compare() {
  const { t } = useI18n();
  const { settings, sysPrompt, toast, setMode } = useApp();
  const [slots, setSlots] = useState<Slot[]>(() => {
    try {
      const saved = JSON.parse(lsGet('mc.compare.slots', '[]'));
      if (Array.isArray(saved) && saved.length >= 2) return saved.map((s: any) => ({ ...s, text: '', state: 'idle' }));
    } catch { /* noop */ }
    return [
      { modelId: 'pollinations/openai-fast', text: '', state: 'idle' as const },
      { modelId: 'pollinations/openai', text: '', state: 'idle' as const },
    ];
  });
  const [prompt, setPrompt] = useState('');
  const [ran, setRan] = useState(false);
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => { lsSet('mc.compare.slots', JSON.stringify(slots.map(({ modelId }) => ({ modelId })))); }, [slots]);

  useEffect(() => () => ctrlRef.current?.abort(), []);

  const setSlot = (i: number, patch: Partial<Slot>) =>
    setSlots((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const run = (p: string) => {
    if (slots.some((s) => s.state === 'run')) return;
    setPrompt(p);
    setRan(true);
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setSlots((ss) => ss.map((s) => ({ ...s, text: '', state: 'run' as const })));

    slots.forEach((slot, i) => {
      // resolveModel falls back to a working model when the saved pick is gone
      const model = resolveModel(slot.modelId, settings.customModels);
      if (model.id !== slot.modelId) setSlot(i, { modelId: model.id });
      void chatWithResilience(providerOf(model.id), {
        model,
        messages: [{ role: 'user', content: p }],
        systemPrompt: sysPrompt,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        signal: ctrl.signal,
        onToken: (tok) => setSlots((ss) => ss.map((s, j) => (j === i ? { ...s, text: s.text + tok } : s))),
      })
        .then(() => setSlot(i, { state: 'done' }))
        .catch((e) => {
          const mcE = e instanceof McError ? e : new McError('server');
          setSlot(i, { state: mcE.code === 'abort' ? 'done' : 'err' });
        });
    });
  };

  const allSettled = ran && slots.every((s) => s.state === 'done' || s.state === 'err');
  const anyGood = slots.filter((s) => s.text.trim());

  const continueWith = (slot: Slot) => {
    if (!slot.text.trim()) return;
    const handoff: Handoff = {
      messages: [
        { role: 'user', content: prompt },
        { role: 'assistant', content: slot.text },
      ],
      modelId: slot.modelId,
      ts: Date.now(),
    };
    saveObj(K_HANDOFF, handoff);
    setMode('chat');
    toast(`${getModel(slot.modelId)?.name || slot.modelId} — ${t('chat.title')}`, 'ok');
  };

  return (
    <div>
      <PageHeader title={t('compare.title')} desc={t('compare.desc')} />

      <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {slots.map((slot, i) => (
          <div key={i} className="flex items-center gap-2">
            <ModelPicker
              value={slot.modelId}
              onChange={(id) => setSlot(i, { modelId: id })}
              className="flex-1"
            />
            {slots.length > 2 && (
              <button
                onClick={() => setSlots((ss) => ss.filter((_, j) => j !== i))}
                className="rounded-lg border border-line p-2.5 text-zinc-500 hover:text-rose-400"
                title={t('c.delete')}
              >
                <IconX className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mb-4">
        <Btn
          variant="outline"
          disabled={slots.length >= MAX_SLOTS}
          onClick={() => setSlots((ss) => [...ss, { modelId: 'pollinations/openai-fast', text: '', state: 'idle' }])}
        >
          <IconPlus className="w-4 h-4" />{t('compare.addModel')}
          {slots.length >= MAX_SLOTS && <span className="text-xs text-zinc-500">({t('compare.max')})</span>}
        </Btn>
      </div>

      {ran && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {slots.map((slot, i) => (
            <Card key={i} className="flex min-h-40 flex-col p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="truncate font-bold text-white">{getModel(slot.modelId)?.name || slot.modelId}</span>
                {slot.state === 'run' && <Spinner className="w-4 h-4" />}
                {slot.state === 'err' && <span className="text-xs font-bold text-rose-400">{t('c.error')}</span>}
              </div>
              <div className="flex-1 overflow-y-auto max-h-[50vh]">
                {slot.text ? <Markdown text={slot.text} /> : slot.state === 'run' ? <span className="text-sm text-zinc-500 streaming">{t('c.thinking')}</span> : <span className="text-sm text-zinc-600">—</span>}
              </div>
              {allSettled && slot.text.trim() && (
                <div className="mt-3 border-t border-line pt-3">
                  <Btn variant="primary" className="w-full" onClick={() => continueWith(slot)}>
                    ▶ {t('compare.continue')}
                  </Btn>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {ran && allSettled && anyGood.length > 0 && (
        <div className="mt-3 text-center text-xs text-zinc-500">{t('compare.pickWinner')}</div>
      )}

      <div className="mt-4">
        <ChatInput
          onSend={run}
          busy={ran && !allSettled}
          onStop={() => ctrlRef.current?.abort()}
          placeholder={`${t('compare.run')} — ${t('c.prompt')}…`}
          large
        />
      </div>
    </div>
  );
}
