import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import en from './locales/en.json';
import fa from './locales/fa.json';
import ar from './locales/ar.json';
import zh from './locales/zh-CN.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ru from './locales/ru.json';
import pt from './locales/pt-BR.json';
import hi from './locales/hi.json';
import tr from './locales/tr.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import id from './locales/id.json';

export interface LangDef { code: string; name: string; native: string }

/** 14 UI languages. Adding one = add file + one line here. */
export const LANGS: LangDef[] = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'fa', name: 'Persian', native: 'فارسی' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'zh-CN', name: 'Chinese', native: '简体中文' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'pt-BR', name: 'Portuguese', native: 'Português (BR)' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
];

const RTL = new Set(['fa', 'ar']);

const PACKS: Record<string, Record<string, string>> = {
  'en': en as any, 'fa': fa as any, 'ar': ar as any, 'zh-CN': zh as any,
  'es': es as any, 'fr': fr as any, 'de': de as any, 'ru': ru as any,
  'pt-BR': pt as any, 'hi': hi as any, 'tr': tr as any, 'ja': ja as any,
  'ko': ko as any, 'id': id as any,
};

const LS_LANG = 'mc.lang';

function detectLang(): string {
  const saved = (() => { try { return localStorage.getItem(LS_LANG); } catch { return null; } })();
  if (saved && PACKS[saved]) return saved;
  const cands: string[] = [
    ...(navigator.languages || []),
    navigator.language || 'en',
  ];
  for (const c of cands) {
    if (PACKS[c]) return c;
    const base = c.split('-')[0];
    const hit = Object.keys(PACKS).find((k) => k.split('-')[0] === base);
    if (hit) return hit;
  }
  return 'en';
}

interface I18nCtx {
  lang: string;
  setLang: (l: string) => void;
  dir: 'ltr' | 'rtl';
  isRtl: boolean;
  t: (key: string) => string;
  /** name of the UI language in its own script — for AI language forcing */
  nativeName: string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<string>(() => detectLang());

  const dir: 'ltr' | 'rtl' = RTL.has(lang) ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = (l: string) => {
    if (!PACKS[l]) return;
    setLangState(l);
    try { localStorage.setItem(LS_LANG, l); } catch { /* noop */ }
  };

  const value = useMemo<I18nCtx>(() => {
    const pack = PACKS[lang] || en;
    const t = (key: string): string => pack[key] ?? (en as any)[key] ?? key;
    return {
      lang,
      setLang,
      dir,
      isRtl: dir === 'rtl',
      t,
      nativeName: LANGS.find((l) => l.code === lang)?.native || 'English',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, dir]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside provider');
  return v;
}

/** System-prompt suffix that forces the AI to answer in the UI language. */
export function forceLangSuffix(nativeName: string): string {
  return ` Always respond in ${nativeName} regardless of the language of the prompt.`;
}
