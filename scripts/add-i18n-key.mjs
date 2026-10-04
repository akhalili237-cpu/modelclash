// Adds "image.needGemini" to every locale (run: node scripts/add-i18n-key.mjs)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../src/i18n/locales');
const M = {
  en: 'Add a free Gemini API key in Settings to unlock Imagen 4 & Nano Banana.',
  fa: 'برای فعال‌سازی Imagen 4 و Nano Banana، یک کلید رایگان Gemini در تنظیمات اضافه کنید.',
  ar: 'أضف مفتاح Gemini مجاني في الإعدادات لفتح Imagen 4 و Nano Banana.',
  'zh-CN': '在设置中添加免费的 Gemini API 密钥，解锁 Imagen 4 与 Nano Banana。',
  es: 'Añade una clave gratuita de Gemini en Ajustes para desbloquear Imagen 4 y Nano Banana.',
  fr: 'Ajoutez une clé Gemini gratuite dans les réglages pour débloquer Imagen 4 et Nano Banana.',
  de: 'Füge in den Einstellungen einen kostenlosen Gemini-API-Schlüssel hinzu, um Imagen 4 und Nano Banana freizuschalten.',
  ru: 'Добавьте бесплатный ключ Gemini в настройках, чтобы открыть Imagen 4 и Nano Banana.',
  'pt-BR': 'Adicione uma chave gratuita do Gemini nas configurações para desbloquear Imagen 4 e Nano Banana.',
  hi: 'Imagen 4 और Nano Banana अनलॉक करने के लिए सेटिंग्स में मुफ़्त Gemini API कुंजी जोड़ें।',
  tr: 'Imagen 4 ve Nano Banana\u2019yı açmak için Ayarlar\u2019da ücretsiz bir Gemini anahtarı ekleyin.',
  ja: '設定で無料のGemini APIキーを追加すると、Imagen 4とNano Bananaが使えます。',
  ko: '설정에서 무료 Gemini API 키를 추가하면 Imagen 4와 Nano Banana를 사용할 수 있습니다.',
  id: 'Tambahkan kunci Gemini gratis di Pengaturan untuk membuka Imagen 4 dan Nano Banana.',
};

for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const lang = f.replace('.json', '');
  const p = join(dir, f);
  const j = JSON.parse(readFileSync(p, 'utf8'));
  if (!j['image.needGemini']) {
    j['image.needGemini'] = M[lang] || M.en;
    writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
    console.log('added →', lang);
  } else {
    console.log('skip  →', lang);
  }
}
