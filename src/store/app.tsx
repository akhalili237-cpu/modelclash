import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getKeys, setKey as persistKey, type Keys } from '../lib/keys';
import { useI18n } from '../i18n';

/* ── settings ──────────────────────────────────────────────────────── */

export interface Settings {
  forceLang: boolean;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  customModels: string;
}

const DEFAULTS: Settings = {
  forceLang: true,
  systemPrompt: '',
  temperature: 0.8,
  maxTokens: 2048,
  customModels: '',
};

const LS_SETTINGS = 'mc.settings';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch { return DEFAULTS; }
}

/** Effective system prompt: user's prompt + optional language forcing. */
export function buildSys(settings: Settings, nativeName: string): string {
  const base = settings.systemPrompt.trim();
  return settings.forceLang
    ? `${base}${base ? ' ' : ''}Always respond in ${nativeName} regardless of the language of the prompt.`.trim()
    : base;
}

/* ── toasts ────────────────────────────────────────────────────────── */

export interface ToastAction { label: string; onClick: () => void }
export interface Toast {
  id: number;
  msg: string;
  kind: 'ok' | 'err' | 'info';
  actions?: ToastAction[];
}

/* ── context shape ─────────────────────────────────────────────────── */

export type Mode = 'chat' | 'battle' | 'tournament' | 'image' | 'leaderboard' | 'compare';

interface AppCtx {
  settings: Settings;
  patchSettings: (patch: Partial<Settings>) => void;
  keys: Keys;
  setKey: (provider: string, v: string) => void;
  toast: (msg: string, kind?: Toast['kind'], actions?: ToastAction[]) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  /** bump to force modes to re-read shared data (elo, galleries…) */
  dataVersion: number;
  bumpData: () => void;
  /** effective system prompt for the current UI language */
  sysPrompt: string;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [keys, setKeysState] = useState<Keys>(getKeys);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mode, setModeState] = useState<Mode>(() => {
    const h = location.hash.replace('#', '') as Mode;
    return ['chat', 'battle', 'tournament', 'image', 'leaderboard', 'compare'].includes(h) ? h : 'chat';
  });
  const [dataVersion, setDataVersion] = useState(0);
  const idRef = useRef(0);
  const { nativeName } = useI18n();

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      try { localStorage.setItem(LS_SETTINGS, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const setKey = useCallback((provider: string, v: string) => {
    persistKey(provider, v);
    setKeysState(getKeys());
  }, []);

  const toast = useCallback((msg: string, kind: Toast['kind'] = 'info', actions?: ToastAction[]) => {
    const id = ++idRef.current;
    setToasts((ts) => [...ts.slice(-2), { id, msg, kind, actions }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), actions ? 9000 : 3800);
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    try { location.hash = m; } catch { /* noop */ }
  }, []);

  const bumpData = useCallback(() => setDataVersion((v) => v + 1), []);

  useEffect(() => {
    const onHash = () => {
      const h = location.hash.replace('#', '') as Mode;
      if (['chat', 'battle', 'tournament', 'image', 'leaderboard', 'compare'].includes(h)) setModeState(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const sysPrompt = useMemo(() => buildSys(settings, nativeName), [settings, nativeName]);

  const value = useMemo<AppCtx>(
    () => ({ settings, patchSettings, keys, setKey, toast, mode, setMode, dataVersion, bumpData, sysPrompt }),
    [settings, patchSettings, keys, setKey, toast, mode, setMode, dataVersion, bumpData, sysPrompt],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* toast host */}
      <div className="fixed bottom-4 inset-x-0 z-[90] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto animate-fade-up max-w-md w-full sm:w-auto rounded-xl border px-4 py-2.5 text-sm shadow-xl backdrop-blur flex items-center gap-3 ${
              t.kind === 'err'
                ? 'bg-rose-950/85 border-rose-800 text-rose-100'
                : t.kind === 'ok'
                  ? 'bg-emerald-950/85 border-emerald-800 text-emerald-100'
                  : 'bg-panel2/95 border-line text-zinc-200'
            }`}
          >
            <span className="flex-1">{t.msg}</span>
            {t.actions?.map((a, i) => (
              <button
                key={i}
                onClick={() => { a.onClick(); setToasts((ts) => ts.filter((x) => x.id !== t.id)); }}
                className="shrink-0 rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1 text-xs font-semibold"
              >
                {a.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}
