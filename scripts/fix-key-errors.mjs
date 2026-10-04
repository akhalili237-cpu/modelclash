// Fixes the "wrong key" confusion across every locale (run: node scripts/fix-key-errors.mjs)
//  - err.key        → now means ONLY an invalid/missing key (401)
//  - err.credits    → NEW: 402 — key valid, model needs paid credits
//  - err.forbidden  → NEW: 403 — provider refusal (region/moderation)
//  - settings.keyChecking / keyOk / keyBad → live key validation in Settings
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../src/i18n/locales');

const M = {
  en: {
    'err.key': 'API key invalid or missing — re-enter it in Settings.',
    'err.credits': 'Your key is valid, but this model needs paid credits — top up your account or pick a FREE model.',
    'err.forbidden': 'The provider refused this request (region or content restriction) — try another model.',
    'settings.keyChecking': 'Checking key…',
    'settings.keyOk': 'Key valid ✓',
    'settings.keyBad': 'Invalid key — check it and paste again',
  },
  fa: {
    'err.key': 'کلید API نامعتبر یا وارد نشده است — آن را در تنظیمات دوباره وارد کنید.',
    'err.credits': 'کلید شما معتبر است اما این مدل اعتبار پولی می‌خواهد — حساب را شارژ کنید یا مدلِ FREE انتخاب کنید.',
    'err.forbidden': 'سرویس‌دهنده این درخواست را نپذیرفت (محدودیت منطقه یا محتوا) — مدل دیگری را امتحان کنید.',
    'settings.keyChecking': 'در حال بررسی کلید…',
    'settings.keyOk': 'کلید معتبر است ✓',
    'settings.keyBad': 'کلید نامعتبر است — بررسی و دوباره واردش کنید',
  },
  ar: {
    'err.key': 'مفتاح API غير صالح أو غير موجود — أعد إدخاله في الإعدادات.',
    'err.credits': 'مفتاحك صالح لكن هذا النموذج يحتاج رصيداً مدفوعاً — اشحن حسابك أو اختر نموذجاً مجانياً.',
    'err.forbidden': 'رفض المزوّد هذا الطلب (قيد منطقة أو محتوى) — جرّب نموذجاً آخر.',
    'settings.keyChecking': 'جارٍ التحقق من المفتاح…',
    'settings.keyOk': 'المفتاح صالح ✓',
    'settings.keyBad': 'مفتاح غير صالح — تحقق منه وأعد لصقه',
  },
  'zh-CN': {
    'err.key': 'API 密钥无效或未填写 — 请在设置中重新输入。',
    'err.credits': '密钥有效，但该模型需要付费额度 — 请充值或改用 FREE 模型。',
    'err.forbidden': '服务商拒绝了该请求（地区或内容限制）— 请换一个模型。',
    'settings.keyChecking': '正在验证密钥…',
    'settings.keyOk': '密钥有效 ✓',
    'settings.keyBad': '密钥无效 — 请核对后重新粘贴',
  },
  es: {
    'err.key': 'La clave API no es válida o falta — vuelve a introducirla en Ajustes.',
    'err.credits': 'Tu clave es válida, pero este modelo requiere créditos de pago — recarga tu cuenta o elige un modelo FREE.',
    'err.forbidden': 'El proveedor rechazó la solicitud (restricción regional o de contenido) — prueba otro modelo.',
    'settings.keyChecking': 'Verificando clave…',
    'settings.keyOk': 'Clave válida ✓',
    'settings.keyBad': 'Clave no válida — revísala y pégala de nuevo',
  },
  fr: {
    'err.key': 'Clé API invalide ou manquante — ressaisissez-la dans les réglages.',
    'err.credits': 'Votre clé est valide, mais ce modèle nécessite des crédits payants — rechargez votre compte ou choisissez un modèle FREE.',
    'err.forbidden': 'Le fournisseur a refusé la requête (restriction régionale ou de contenu) — essayez un autre modèle.',
    'settings.keyChecking': 'Vérification de la clé…',
    'settings.keyOk': 'Clé valide ✓',
    'settings.keyBad': 'Clé invalide — vérifiez et recollez-la',
  },
  de: {
    'err.key': 'API-Schlüssel ungültig oder fehlt — bitte in den Einstellungen neu eingeben.',
    'err.credits': 'Dein Schlüssel ist gültig, aber dieses Modell benötigt Guthaben — Konto aufladen oder ein FREE-Modell wählen.',
    'err.forbidden': 'Der Anbieter hat die Anfrage abgelehnt (Regions- oder Inhaltsbeschränkung) — anderes Modell versuchen.',
    'settings.keyChecking': 'Schlüssel wird geprüft…',
    'settings.keyOk': 'Schlüssel gültig ✓',
    'settings.keyBad': 'Ungültiger Schlüssel — prüfen und erneut einfügen',
  },
  ru: {
    'err.key': 'API-ключ недействителен или отсутствует — введите его заново в настройках.',
    'err.credits': 'Ключ действителен, но этой модели нужна платная квота — пополните счёт или выберите FREE-модель.',
    'err.forbidden': 'Провайдер отклонил запрос (региональные ограничения или контент) — попробуйте другую модель.',
    'settings.keyChecking': 'Проверка ключа…',
    'settings.keyOk': 'Ключ действителен ✓',
    'settings.keyBad': 'Недействительный ключ — проверьте и вставьте заново',
  },
  'pt-BR': {
    'err.key': 'Chave de API inválida ou ausente — insira-a novamente em Ajustes.',
    'err.credits': 'Sua chave é válida, mas este modelo exige créditos pagos — recarregue a conta ou escolha um modelo FREE.',
    'err.forbidden': 'O provedor recusou a solicitação (restrição regional ou de conteúdo) — tente outro modelo.',
    'settings.keyChecking': 'Verificando chave…',
    'settings.keyOk': 'Chave válida ✓',
    'settings.keyBad': 'Chave inválida — verifique e cole novamente',
  },
  hi: {
    'err.key': 'API कुंजी अमान्य या अनुपस्थित है — इसे सेटिंग्स में फिर से दर्ज करें।',
    'err.credits': 'आपकी कुंजी मान्य है, पर इस मॉडल के लिए सशुल्क क्रेडिट चाहिए — खाता रिचार्ज करें या FREE मॉडल चुनें।',
    'err.forbidden': 'प्रदाता ने अनुरोध अस्वीकार किया (क्षेत्र/सामग्री प्रतिबंध) — दूसरा मॉडल आज़माएँ।',
    'settings.keyChecking': 'कुंजी की जाँच हो रही है…',
    'settings.keyOk': 'कुंजी मान्य है ✓',
    'settings.keyBad': 'अमान्य कुंजी — जाँचकर दोबारा पेस्ट करें',
  },
  tr: {
    'err.key': 'API anahtarı geçersiz veya eksik — Ayarlar\u2019dan yeniden girin.',
    'err.credits': 'Anahtarınız geçerli ama bu model ücretli kredi istiyor — hesabınıza bakiye yükleyin ya da FREE model seçin.',
    'err.forbidden': 'Sağlayıcı isteği reddetti (bölge/içerik kısıtı) — başka bir model deneyin.',
    'settings.keyChecking': 'Anahtar doğrulanıyor…',
    'settings.keyOk': 'Anahtar geçerli ✓',
    'settings.keyBad': 'Geçersiz anahtar — kontrol edip yeniden yapıştırın',
  },
  ja: {
    'err.key': 'APIキーが無効または未入力です — 設定で再入力してください。',
    'err.credits': 'キーは有効ですが、このモデルには有料クレジットが必要です — チャージするか FREE モデルを選んでください。',
    'err.forbidden': 'プロバイダーがリクエストを拒否しました（地域/コンテンツ制限）— 別のモデルをお試しください。',
    'settings.keyChecking': 'キーを確認中…',
    'settings.keyOk': 'キーは有効です ✓',
    'settings.keyBad': '無効なキーです — 確認して貼り直してください',
  },
  ko: {
    'err.key': 'API 키가 잘못되었거나 없습니다 — 설정에서 다시 입력하세요.',
    'err.credits': '키는 유효하지만 이 모델은 유료 크레딧이 필요합니다 — 충전하거나 FREE 모델을 선택하세요.',
    'err.forbidden': '제공자가 요청을 거부했습니다(지역/콘텐츠 제한) — 다른 모델을 시도하세요.',
    'settings.keyChecking': '키 확인 중…',
    'settings.keyOk': '키 유효 ✓',
    'settings.keyBad': '잘못된 키입니다 — 확인 후 다시 붙여넣으세요',
  },
  id: {
    'err.key': 'Kunci API tidak valid atau belum diisi — masukkan ulang di Pengaturan.',
    'err.credits': 'Kunci Anda valid, tetapi model ini butuh kredit berbayar — isi saldo atau pilih model FREE.',
    'err.forbidden': 'Penyedia menolak permintaan ini (batasan wilayah/konten) — coba model lain.',
    'settings.keyChecking': 'Memeriksa kunci…',
    'settings.keyOk': 'Kunci valid ✓',
    'settings.keyBad': 'Kunci tidak valid — periksa dan tempel ulang',
  },
};

const KEYS = Object.keys(M.en);
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const lang = f.replace('.json', '');
  const p = join(dir, f);
  const j = JSON.parse(readFileSync(p, 'utf8'));
  const dict = M[lang] || M.en;
  for (const k of KEYS) j[k] = dict[k]; // overwrite err.key, add the new ones
  writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  console.log('updated →', lang);
}
