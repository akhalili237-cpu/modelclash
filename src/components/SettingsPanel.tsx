import { useEffect, useRef, useState } from 'react';
import { Modal, Btn } from './ui';
import { useApp } from '../store/app';
import { useI18n, LANGS } from '../i18n';
import { LOCAL_MODELS, webllmState, ensureEngine, hasWebGPU } from '../providers/webllm';
import { resetElo } from '../lib/elo';
import { K_BATTLES, K_CHATS, K_GALLERY, K_PROMPTS, K_TOURNAMENT, dropKey } from '../lib/storage';
import { cn } from '../lib/utils';
import { validateKey, validateSaved, type KeyCheck } from '../lib/validate';
import { IconCheck, IconTrash } from './icons';

const KEY_PROVIDERS = [
  { id: 'openrouter', label: 'OpenRouter', url: 'https://openrouter.ai/keys' },
  { id: 'groq', label: 'Groq', url: 'https://console.groq.com/keys' },
  { id: 'gemini', label: 'Google Gemini', url: 'https://aistudio.google.com/apikey' },
  { id: 'pollinations', label: 'Pollinations (tier up)', url: 'https://auth.pollinations.ai' },
];

export function SettingsPanel({ open, onClose, onOpenPrompts }: {
  open: boolean;
  onClose: () => void;
  onOpenPrompts: () => void;
}) {
  const { t, lang, setLang } = useI18n();
  const { settings, patchSettings, keys, setKey, toast } = useApp();

  const [localTick, setLocalTick] = useState(0);
  const [loadingModel, setLoadingModel] = useState('');
  const [progress, setProgress] = useState('');
  const [keyStatus, setKeyStatus] = useState<Record<string, KeyCheck | undefined>>({});
  const keyTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const gpuOk = hasWebGPU();

  useEffect(() => {
    if (!open) return;
    const iv = setInterval(() => setLocalTick((x) => x + 1), 800);
    return () => clearInterval(iv);
  }, [open]);

  // When the panel opens, verify every saved key once so the user immediately
  // sees whether each key is actually valid (not just "something was pasted").
  useEffect(() => {
    if (!open) return;
    let alive = true;
    validateSaved(keys).then((r) => { if (alive) setKeyStatus(r); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Save the key, then validate it live (debounced) — instant true/false feedback. */
  const updateKey = (pid: string, v: string) => {
    setKey(pid, v.trim());
    clearTimeout(keyTimers.current[pid]);
    if (!v.trim() || pid === 'pollinations') {
      setKeyStatus((s) => ({ ...s, [pid]: undefined }));
      return;
    }
    setKeyStatus((s) => ({ ...s, [pid]: { status: 'checking' } }));
    keyTimers.current[pid] = setTimeout(async () => {
      const r = await validateKey(pid, v);
      setKeyStatus((s) => ({ ...s, [pid]: r }));
    }, 600);
  };

  const loadLocal = async (modelId: string) => {
    setLoadingModel(modelId);
    setProgress('');
    try {
      await ensureEngine(modelId, setProgress);
      toast(t('settings.ready'), 'ok');
    } catch {
      toast(t('err.local'), 'err');
    } finally {
      setLoadingModel('');
      setLocalTick((x) => x + 1);
    }
  };

  const clearAll = async () => {
    if (!confirm(t('c.confirm'))) return;
    resetElo();
    await Promise.all([K_CHATS, K_BATTLES, K_GALLERY, K_PROMPTS, K_TOURNAMENT].map(dropKey));
    toast(t('settings.cleared'), 'ok');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('settings.title')} wide>
      <div className="space-y-7" data-tick={localTick}>
        {/* language */}
        <section>
          <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-zinc-500">{t('settings.language')}</label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="w-full rounded-xl border border-line bg-panel2 px-3 py-2.5 text-sm outline-none focus:border-accent/50"
          >
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.native} — {l.name}</option>)}
          </select>
          <label className="mt-2.5 flex cursor-pointer items-center gap-2.5 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={settings.forceLang}
              onChange={(e) => patchSettings({ forceLang: e.target.checked })}
              className="h-4 w-4 accent-orange-500"
            />
            {t('settings.forceLang')}
          </label>
        </section>

        {/* generation */}
        <section>
          <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-zinc-500">{t('settings.systemPrompt')}</label>
          <textarea
            value={settings.systemPrompt}
            onChange={(e) => patchSettings({ systemPrompt: e.target.value })}
            placeholder={t('settings.systemPromptPh')}
            rows={3}
            className="w-full resize-none rounded-xl border border-line bg-panel2 px-3 py-2.5 text-sm outline-none focus:border-accent/50"
            dir="auto"
          />
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="mb-1 flex justify-between text-xs text-zinc-400">
                <span>{t('settings.temperature')}</span>
                <span className="font-mono text-orange-300">{settings.temperature.toFixed(2)}</span>
              </div>
              <input
                type="range" min={0} max={2} step={0.05}
                value={settings.temperature}
                onChange={(e) => patchSettings({ temperature: Number(e.target.value) })}
                className="w-full accent-orange-500"
              />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-zinc-400">
                <span>{t('settings.maxTokens')}</span>
                <span className="font-mono text-orange-300">{settings.maxTokens}</span>
              </div>
              <input
                type="range" min={256} max={8192} step={256}
                value={settings.maxTokens}
                onChange={(e) => patchSettings({ maxTokens: Number(e.target.value) })}
                className="w-full accent-orange-500"
              />
            </div>
          </div>
        </section>

        {/* API keys */}
        <section>
          <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-500">{t('settings.apiKeys')}</h3>
          <p className="mb-3 text-xs text-zinc-500">{t('settings.apiKeysDesc')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {KEY_PROVIDERS.map((p) => {
              const st = keyStatus[p.id];
              return (
                <div key={p.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-zinc-300 hover:text-orange-300">
                      {p.label} ↗
                    </a>
                    {keys[p.id as keyof typeof keys] && <IconCheck className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <input
                    type="password"
                    value={keys[p.id as keyof typeof keys] || ''}
                    onChange={(e) => updateKey(p.id, e.target.value)}
                    placeholder={t('settings.keyPh')}
                    className={cn(
                      'w-full rounded-xl border bg-panel2 px-3 py-2 font-mono text-xs outline-none focus:border-accent/50',
                      st?.status === 'bad' ? 'border-rose-800' : 'border-line',
                    )}
                    dir="ltr"
                    autoComplete="off"
                  />
                  {st?.status === 'checking' && (
                    <div className="mt-1 text-[11px] text-zinc-500">{t('settings.keyChecking')}</div>
                  )}
                  {st?.status === 'ok' && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                      <IconCheck className="h-3 w-3 shrink-0" />
                      {t('settings.keyOk')}{st.info && <span className="font-mono font-normal text-emerald-500/80"> · {st.info}</span>}
                    </div>
                  )}
                  {st?.status === 'bad' && (
                    <div className="mt-1 text-[11px] font-semibold text-rose-400">{t('settings.keyBad')}</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* local models */}
        <section>
          <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-500">{t('settings.webllm')}</h3>
          {gpuOk ? (
            <>
              <p className="mb-3 text-xs text-zinc-500">{t('settings.webllmDesc')}</p>
              <div className="space-y-2">
                {LOCAL_MODELS.map((m) => {
                  const isReady = webllmState.ready && webllmState.model === m.model;
                  const isLoading = loadingModel === m.model;
                  return (
                    <div key={m.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel2/60 px-3 py-2.5">
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-zinc-200">{m.name}</div>
                        <div className="text-[11px] text-zinc-500">{m.note}</div>
                        {isLoading && progress && (
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-line">
                            <div className="h-full w-1/3 animate-shimmer rounded-full bg-gradient-to-r from-accent to-accent2" style={{ backgroundSize: '200% 100%' }} />
                          </div>
                        )}
                      </div>
                      {isReady ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                          <IconCheck className="w-4 h-4" />{t('settings.ready')}
                        </span>
                      ) : (
                        <Btn variant="outline" onClick={() => loadLocal(m.model)} disabled={!!loadingModel}>
                          {isLoading ? t('settings.loadingModel') : t('settings.load')}
                        </Btn>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="rounded-xl border border-amber-900/60 bg-amber-950/40 px-3 py-2.5 text-xs text-amber-200">
              {t('settings.noWebGPU')}
            </p>
          )}
        </section>

        {/* custom models */}
        <section>
          <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-500">{t('settings.customModels')}</h3>
          <p className="mb-2 text-xs text-zinc-500">{t('settings.customModelsDesc')}</p>
          <textarea
            value={settings.customModels}
            onChange={(e) => patchSettings({ customModels: e.target.value })}
            rows={3}
            placeholder={'groq/llama-guard-4\nopenrouter/mistralai/mistral-small-3.1-24b-instruct:free'}
            className="w-full resize-none rounded-xl border border-line bg-panel2 px-3 py-2.5 font-mono text-xs outline-none focus:border-accent/50"
            dir="ltr"
          />
        </section>

        {/* data */}
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-500">{t('settings.data')}</h3>
          <button
            onClick={clearAll}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border border-rose-900/70 bg-rose-950/40 px-3 py-3 text-start hover:bg-rose-950/70 transition-colors',
            )}
          >
            <IconTrash className="w-5 h-5 shrink-0 text-rose-400" />
            <span>
              <span className="block text-sm font-bold text-rose-200">{t('settings.clearData')}</span>
              <span className="block text-xs text-rose-300/70">{t('settings.clearDataDesc')}</span>
            </span>
          </button>
        </section>
      </div>
    </Modal>
  );
}
