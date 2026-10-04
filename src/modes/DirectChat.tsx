import { useCallback, useEffect, useRef, useState } from 'react';
import { ModelPicker } from '../components/ModelPicker';
import { ChatInput } from '../components/ChatInput';
import { Markdown } from '../components/Markdown';
import { ErrorBanner } from '../components/ErrorBanner';
import { Btn, Card, Chip, PageHeader } from '../components/ui';
import { IconDownload, IconHistory, IconPlus, IconRefresh, IconVolume } from '../components/icons';
import { useApp } from '../store/app';
import { useI18n } from '../i18n';
import { getModel, providerOf, resolveModel } from '../providers/registry';
import { chatWithResilience } from '../lib/chat';
import { McError, type ChatMessage } from '../types';
import { K_CHATS, K_HANDOFF, loadList, loadObj, saveList, dropKey, type ChatSession, type Handoff } from '../lib/storage';
import { exportMarkdown } from '../lib/share';
import { lsGet, lsSet } from '../lib/keys';
import { speak, stopSpeaking, ttsSupported } from '../lib/voice';
import { truncate } from '../lib/utils';

interface Msg { role: 'user' | 'assistant'; content: string; modelId?: string }

export function DirectChat() {
  const { t, lang } = useI18n();
  const { settings, sysPrompt, toast, setMode, bumpData, dataVersion } = useApp();
  const [modelId, setModelId] = useState(() => lsGet('mc.pick.chat', 'pollinations/openai-fast'));
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<McError | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ChatSession[]>([]);
  const ctrlRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const spokeRef = useRef(false);

  useEffect(() => lsSet('mc.pick.chat', modelId), [modelId]);

  // auto-heal: if the saved pick is missing from the (live-refreshed) catalog,
  // switch to a model that exists so the send button always works
  useEffect(() => {
    if (!getModel(modelId, settings.customModels)) setModelId(resolveModel(modelId, settings.customModels).id);
  }, [dataVersion, settings.customModels]);

  useEffect(() => {
    loadList<ChatSession>(K_CHATS).then((l) => setHistory(l.sort((a, b) => b.ts - a.ts).slice(0, 30)));
  }, [dataVersion]);

  // handoff from Compare mode
  useEffect(() => {
    loadObj<Handoff>(K_HANDOFF).then((h) => {
      if (h && Date.now() - h.ts < 60_000) {
        setMessages(h.messages.map((m) => ({ ...m })));
        setModelId(h.modelId);
        dropKey(K_HANDOFF);
      }
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => () => { ctrlRef.current?.abort(); stopSpeaking(); }, []);

  const save = useCallback(async (msgs: Msg[]) => {
    if (!msgs.length) return;
    const firstUser = msgs.find((m) => m.role === 'user');
    const session: ChatSession = {
      id: `${Date.now()}`,
      title: truncate(firstUser?.content || 'Chat', 48),
      modelId,
      messages: msgs,
      ts: Date.now(),
    };
    const list = await loadList<ChatSession>(K_CHATS);
    list.push(session);
    await saveList(K_CHATS, list.slice(-60));
    bumpData();
  }, [modelId, bumpData]);

  const send = useCallback(async (text: string, regenerateBase?: Msg[]) => {
    if (busy) return;
    // resolveModel never returns undefined: if the saved pick vanished from the
    // catalog it heals to a working keyless model instead of silently doing nothing
    const model = resolveModel(modelId, settings.customModels);
    if (model.id !== modelId) {
      setModelId(model.id);
      toast(t('c.autoSwitch').replace('{m}', model.name), 'info');
    }

    const base = regenerateBase ?? messages;
    const userMsgs: Msg[] = [...base, { role: 'user', content: text }];
    const withPlaceholder: Msg[] = [...userMsgs, { role: 'assistant', content: '', modelId: model.id }];
    setMessages(withPlaceholder);
    setErr(null);
    setBusy(true);
    spokeRef.current = false;

    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    const apiMessages: ChatMessage[] = userMsgs.map((m) => ({ role: m.role, content: m.content }));

    try {
      const full = await chatWithResilience(providerOf(model.id), {
        model,
        messages: apiMessages,
        systemPrompt: sysPrompt,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        signal: ctrl.signal,
        onToken: (tok) => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            copy[copy.length - 1] = { ...last, content: last.content + tok };
            return copy;
          });
        },
      });
      if (!full.trim()) {
        setMessages(userMsgs);
        throw new McError('none');
      }
      const finalMsgs: Msg[] = [...userMsgs, { role: 'assistant' as const, content: full, modelId: model.id }];
      setMessages(finalMsgs);
      await save(finalMsgs);
    } catch (e) {
      const mcE = e instanceof McError ? e : new McError('server', String((e as Error)?.message || e));
      if (mcE.code !== 'abort') setErr(mcE);
      setMessages((prev) => prev.filter((m) => m.content.trim() !== '' || m.role === 'user'));
    } finally {
      setBusy(false);
      ctrlRef.current = null;
    }
  }, [busy, messages, modelId, sysPrompt, settings.temperature, settings.maxTokens, settings.customModels, save, toast, t]);

  const regenerate = () => {
    if (busy || messages.length < 2) return;
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    const idx = messages.lastIndexOf(lastUser);
    const base = messages.slice(0, idx);
    setMessages(base);
    send(lastUser.content, base);
  };

  const doExport = () => {
    if (!messages.length) return;
    const model = getModel(modelId, settings.customModels);
    const md = [
      `# ${t('chat.title')} — ${model?.name || modelId}`,
      '',
      ...messages.map((m) => `## ${m.role === 'user' ? t('c.you') : model?.name || 'AI'}\n\n${m.content}`),
    ].join('\n');
    exportMarkdown(firstTitle(messages) || 'chat', md);
  };

  const loadSession = (s: ChatSession) => {
    setMessages(s.messages.map((m) => ({ ...m })));
    setModelId(s.modelId);
    setHistoryOpen(false);
  };

  const model = resolveModel(modelId, settings.customModels);
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && m.content);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('chat.title')}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHistoryOpen((o) => !o)}
              className="rounded-xl border border-line bg-panel2 p-2.5 text-zinc-400 hover:text-white"
              title={t('c.history')}
            >
              <IconHistory className="w-4.5 h-4.5 w-5 h-5" />
            </button>
            <Btn variant="ghost" onClick={doExport} disabled={!messages.length} title={t('c.export')}>
              <IconDownload className="w-4 h-4" /><span className="hidden sm:inline">{t('c.export')}</span>
            </Btn>
            <Btn
              variant="ghost"
              onClick={() => { setMessages([]); setErr(null); }}
              disabled={!messages.length}
              title={t('c.newChat')}
            >
              <IconPlus className="w-4 h-4" /><span className="hidden sm:inline">{t('c.newChat')}</span>
            </Btn>
          </div>
        }
      />

      <div className="mb-3 flex items-center gap-2">
        <ModelPicker value={modelId} onChange={setModelId} className="min-w-0 flex-1 max-w-sm" />
        <Btn variant="ghost" onClick={regenerate} disabled={busy || messages.length < 2} title={t('c.regenerate')}>
          <IconRefresh className="w-4 h-4" />
        </Btn>
      </div>

      {historyOpen && (
        <Card className="mb-3 max-h-56 overflow-y-auto p-1.5 animate-fade-up">
          {history.length === 0 && <div className="py-4 text-center text-xs text-zinc-600">—</div>}
          {history.map((s) => (
            <button
              key={s.id}
              onClick={() => loadSession(s)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm text-zinc-300 hover:bg-panel2"
            >
              <span className="flex-1 truncate">{s.title}</span>
              <span className="shrink-0 text-[10px] text-zinc-600">{new Date(s.ts).toLocaleDateString()}</span>
            </button>
          ))}
        </Card>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto pe-1">
        {messages.length === 0 && !busy && (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-10 text-center">
            <div className="text-5xl">💬</div>
            <div>
              <h2 className="text-lg font-bold text-white">{t('chat.empty')}</h2>
              <p className="mt-1 text-sm text-zinc-500">{t('chat.emptySub')}</p>
            </div>
            <div className="mt-2 flex max-w-lg flex-wrap justify-center gap-2">
              {(['ex.story', 'ex.code', 'ex.idea', 'ex.learn'] as const).map((k) => (
                <Chip key={k} onClick={() => send(t(k))}>{t(k)}</Chip>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4 pb-4">
          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            const streaming = isLast && busy && m.role === 'assistant';
            const mModel = m.modelId ? getModel(m.modelId, settings.customModels) : undefined;
            return (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
                <div className={`max-w-[92%] sm:max-w-[80%] ${m.role === 'user' ? 'order-1' : ''}`}>
                  <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-zinc-500">
                    {m.role === 'user' ? t('c.you') : mModel?.name || 'AI'}
                  </div>
                  <div
                    className={
                      m.role === 'user'
                        ? 'rounded-2xl rounded-ee-md bg-gradient-to-br from-accent/25 to-accent2/25 border border-accent/30 px-4 py-2.5 text-[15px] text-zinc-100 whitespace-pre-wrap break-words'
                        : streaming
                          ? 'rounded-2xl rounded-es-md border border-line bg-panel px-4 py-3 whitespace-pre-wrap break-words text-[15px] text-zinc-200 streaming'
                          : 'rounded-2xl rounded-es-md border border-line bg-panel px-4 py-3'
                    }
                  >
                    {m.role === 'assistant' && !streaming ? (
                      <Markdown text={m.content} />
                    ) : (
                      m.content || t('c.thinking')
                    )}
                  </div>
                  {m.role === 'assistant' && !streaming && m.content && ttsSupported() && (
                    <button
                      onClick={() => {
                        if (spokeRef.current) { stopSpeaking(); spokeRef.current = false; return; }
                        speak(m.content, lang);
                        spokeRef.current = true;
                      }}
                      className="mt-1 rounded-lg p-1.5 text-zinc-600 hover:text-white hover:bg-white/10"
                      title="TTS"
                    >
                      <IconVolume className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <ErrorBanner error={err} onRetry={() => { const last = [...messages].reverse().find((m) => m.role === 'user'); if (last) { const idx = messages.lastIndexOf(last); send(last.content, messages.slice(0, idx)); } }} onSwitch={() => setErr(null)} onClose={() => setErr(null)} />
        <ChatInput onSend={(v) => send(v)} onStop={() => ctrlRef.current?.abort()} busy={busy} placeholder={`${t('chat.ph')} — ${model?.name || ''}`} large />
        <div className="text-center text-[10px] text-zinc-700">Ctrl+K focus · Ctrl+B {t('nav.battle')} · Ctrl+T {t('nav.tournament')}</div>
      </div>
    </div>
  );
}

function firstTitle(msgs: Msg[]): string {
  const u = msgs.find((m) => m.role === 'user');
  return truncate(u?.content || 'chat', 40);
}
