import { useEffect, useRef, useState } from 'react';
import { useApp } from './store/app';
import { useI18n, LANGS } from './i18n';
import { DirectChat } from './modes/DirectChat';
import { BlindBattle } from './modes/BlindBattle';
import { Tournament } from './modes/Tournament';
import { ImageArena } from './modes/ImageArena';
import { Leaderboard } from './modes/Leaderboard';
import { Compare } from './modes/Compare';
import { SettingsPanel } from './components/SettingsPanel';
import { PromptLibrary } from './components/PromptLibrary';
import {
  IconChat, IconSwords, IconTrophy, IconImage, IconChart, IconColumns,
  IconSettings, IconBook, IconMenu, IconX, IconZap, IconDownload,
} from './components/icons';
import { cn } from './lib/utils';
import { lsGet, lsSet } from './lib/keys';
import { bootstrapProviders, refreshCatalogs } from './providers/registry';

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

const NAV = [
  { id: 'chat', icon: IconChat, key: 'nav.chat' },
  { id: 'battle', icon: IconSwords, key: 'nav.battle' },
  { id: 'tournament', icon: IconTrophy, key: 'nav.tournament' },
  { id: 'image', icon: IconImage, key: 'nav.image' },
  { id: 'leaderboard', icon: IconChart, key: 'nav.leaderboard' },
  { id: 'compare', icon: IconColumns, key: 'nav.compare' },
] as const;

export function App() {
  const { t, lang, setLang, isRtl } = useI18n();
  const { mode, setMode, bumpData, keys } = useApp();
  const [drawer, setDrawer] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);

  /* providers: kick off catalog refresh once → bump so pickers show fresh lists */
  useEffect(() => { bootstrapProviders(bumpData); }, [bumpData]);

  /* when the user saves/removes a key, refresh catalogs (new models may unlock).
     (skip first run — bootstrapProviders already covers it) */
  const firstKeyRun = useRef(true);
  useEffect(() => {
    if (firstKeyRun.current) { firstKeyRun.current = false; return; }
    refreshCatalogs().then(bumpData);
  }, [keys.openrouter, keys.pollinations]);

  /* online/offline indicator */
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  /* PWA install prompt capture (Chromium) */
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (!standalone && isIos && lsGet('mc.install.later') !== '1') {
      setShowIos(true);
    }
    if (standalone || lsGet('mc.install.later') === '1') {
      // user chose later before — still allow beforeinstallprompt card, but no ios card
    }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  /* global shortcuts: Ctrl+K focus, Ctrl+B battle, Ctrl+T tournament, Esc closes */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'k') { e.preventDefault(); window.dispatchEvent(new Event('mc:focus-input')); }
      else if (k === 'b') { e.preventDefault(); setMode('battle'); }
      else if (k === 't') { e.preventDefault(); setMode('tournament'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setMode]);

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {NAV.map(({ id, icon: Icon, key }) => (
        <button
          key={id}
          onClick={() => { setMode(id); setDrawer(false); }}
          className={cn(
            'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors',
            mode === id
              ? 'bg-gradient-to-r from-accent/20 to-accent2/15 text-white border border-accent/30'
              : 'text-zinc-400 hover:bg-panel2 hover:text-zinc-100 border border-transparent',
          )}
        >
          <Icon className="w-5 h-5 shrink-0" />
          {t(key)}
        </button>
      ))}
      <div className="my-2 border-t border-line" />
      <button
        onClick={() => { setPromptsOpen(true); setDrawer(false); }}
        className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-zinc-400 transition-colors hover:bg-panel2 hover:text-zinc-100"
      >
        <IconBook className="w-5 h-5 shrink-0" />{t('nav.prompts')}
      </button>
      <button
        onClick={() => { setSettingsOpen(true); setDrawer(false); }}
        className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-zinc-400 transition-colors hover:bg-panel2 hover:text-zinc-100"
      >
        <IconSettings className="w-5 h-5 shrink-0" />{t('nav.settings')}
      </button>
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5 px-5 pt-5 pb-2">
      <span className="text-2xl" aria-hidden>⚔️</span>
      <div>
        <div className="text-lg font-black leading-none tracking-tight text-white">
          Model<span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-accent2">Clash</span>
        </div>
        <div className="mt-0.5 text-[10px] text-zinc-500">{t('app.tagline')}</div>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-ink text-zinc-200">
      {/* desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-e border-line bg-panel/60">
        {brand}
        {nav}
        <SidebarFooter online={online} installEvt={installEvt} setInstallEvt={setInstallEvt} />
      </aside>

      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDrawer(false)} />
          <aside className={cn(
            'absolute inset-y-0 start-0 flex w-72 flex-col border-e border-line bg-panel shadow-2xl animate-fade-up',
          )}>
            <div className="flex items-center justify-between pe-3">
              {brand}
              <button onClick={() => setDrawer(false)} className="rounded-lg p-2 text-zinc-400 hover:text-white">
                <IconX className="w-5 h-5" />
              </button>
            </div>
            {nav}
            <SidebarFooter online={online} installEvt={installEvt} setInstallEvt={setInstallEvt} />
          </aside>
        </div>
      )}

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile header */}
        <header className="flex items-center gap-2 border-b border-line bg-panel/60 px-3 py-2.5 lg:hidden">
          <button onClick={() => setDrawer(true)} className="rounded-lg p-2 text-zinc-300 hover:bg-panel2">
            <IconMenu className="w-5 h-5" />
          </button>
          <span className="flex-1 font-black tracking-tight text-white">
            Model<span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-accent2">Clash</span>
          </span>
          <span className={cn('h-2 w-2 rounded-full', online ? 'bg-emerald-500' : 'bg-zinc-600')} title={online ? t('c.online') : t('c.offline')} />
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="rounded-lg border border-line bg-panel2 px-1.5 py-1 text-xs outline-none"
            aria-label={t('settings.language')}
          >
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.code.toUpperCase()}</option>)}
          </select>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto h-full max-w-5xl">
            {mode === 'chat' && <DirectChat />}
            {mode === 'battle' && <BlindBattle />}
            {mode === 'tournament' && <Tournament />}
            {mode === 'image' && <ImageArena />}
            {mode === 'leaderboard' && <Leaderboard />}
            {mode === 'compare' && <Compare />}
          </div>
        </main>
      </div>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} onOpenPrompts={() => setPromptsOpen(true)} />
      <PromptLibrary open={promptsOpen} onClose={() => setPromptsOpen(false)} onPick={() => setDrawer(false)} />

      {/* install card (Chromium) */}
      {installEvt && (
        <div className="fixed bottom-4 start-4 z-[60] max-w-xs animate-fade-up rounded-2xl border border-line bg-panel p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚔️</span>
            <div className="flex-1">
              <div className="text-sm font-bold text-white">{t('install.title')}</div>
              <div className="mt-0.5 text-xs text-zinc-400">{t('install.desc')}</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={async () => { await installEvt.prompt(); setInstallEvt(null); }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-accent to-accent2 px-3 py-2 text-xs font-bold text-white"
            >
              <IconDownload className="w-3.5 h-3.5" />{t('install.btn')}
            </button>
            <button
              onClick={() => { lsSet('mc.install.later', '1'); setInstallEvt(null); }}
              className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-zinc-400"
            >
              {t('install.later')}
            </button>
          </div>
        </div>
      )}

      {/* iOS fallback hint */}
      {showIos && (
        <div className="fixed bottom-4 start-4 z-[60] max-w-xs animate-fade-up rounded-2xl border border-line bg-panel p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📱</span>
            <div className="flex-1">
              <div className="text-sm font-bold text-white">{t('install.title')}</div>
              <div className="mt-0.5 text-xs text-zinc-400">{t('install.ios')}</div>
            </div>
            <button onClick={() => { lsSet('mc.install.later', '1'); setShowIos(false); }} className="rounded-lg p-1 text-zinc-500 hover:text-white">
              <IconX className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarFooter({ online, installEvt, setInstallEvt }: {
  online: boolean;
  installEvt: BeforeInstallPromptEvent | null;
  setInstallEvt: (v: BeforeInstallPromptEvent | null) => void;
}) {
  const { t, lang, setLang, isRtl } = useI18n();
  void isRtl;
  return (
    <div className="border-t border-line p-3">
      <div className="flex items-center gap-2">
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="flex-1 rounded-lg border border-line bg-panel2 px-2 py-1.5 text-xs outline-none"
          aria-label={t('settings.language')}
        >
          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.native}</option>)}
        </select>
        <span
          className={cn('h-2 w-2 shrink-0 rounded-full', online ? 'bg-emerald-500' : 'bg-zinc-600')}
          title={online ? t('c.online') : t('c.offline')}
        />
      </div>
      {installEvt && (
        <button
          onClick={async () => { await installEvt.prompt(); setInstallEvt(null); }}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-bold text-orange-200 hover:bg-accent/20"
        >
          <IconZap className="w-3.5 h-3.5" />{t('install.btn')}
        </button>
      )}
    </div>
  );
}
