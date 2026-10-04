// Adds "c.autoSwitch" to every locale (run: node scripts/add-autoswitch-key.mjs)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../src/i18n/locales');
const M = {
  en: 'Model unavailable — switched to {m}',
  fa: 'مدل در دسترس نیست — به {m} تغییر یافت',
  ar: 'النموذج غير متاح — تم التبديل إلى {m}',
  'zh-CN': '该模型不可用 — 已切换到 {m}',
  es: 'Modelo no disponible — cambiado a {m}',
  fr: 'Modèle indisponible — basculé vers {m}',
  de: 'Modell nicht verfügbar — zu {m} gewechselt',
  ru: 'Модель недоступна — переключено на {m}',
  'pt-BR': 'Modelo indisponível — alternado para {m}',
  hi: 'मॉडल उपलब्ध नहीं है — {m} पर स्विच किया गया',
  tr: 'Model kullanılamıyor — {m} modeline geçildi',
  ja: 'モデルが利用不可のため {m} に切り替えました',
  ko: '모델을 사용할 수 없어 {m}(으)로 전환했습니다',
  id: 'Model tidak tersedia — beralih ke {m}',
};

for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const lang = f.replace('.json', '');
  const p = join(dir, f);
  const j = JSON.parse(readFileSync(p, 'utf8'));
  if (!j['c.autoSwitch']) {
    j['c.autoSwitch'] = M[lang] || M.en;
    writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
    console.log('added →', lang);
  } else {
    console.log('skip  →', lang);
  }
}
