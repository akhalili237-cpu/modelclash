/* ── Web Speech API: voice input (STT) + read aloud (TTS) ──────────── */

export function sttSupported(): boolean {
  return typeof window !== 'undefined' &&
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
}

export interface STTHandle {
  start(): void;
  stop(): void;
}

/** Creates a one-shot dictation session. Returns null when unsupported. */
export function createSTT(
  lang: string,
  onText: (text: string, isFinal: boolean) => void,
  onEnd?: () => void,
): STTHandle | null {
  const W = window as any;
  const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.onresult = (e: any) => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (final) onText(final, true);
    else if (interim) onText(interim, false);
  };
  rec.onend = () => onEnd?.();
  rec.onerror = () => onEnd?.();

  return {
    start() { try { rec.start(); } catch { /* already started */ } },
    stop() { try { rec.stop(); } catch { /* noop */ } },
  };
}

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string, lang: string): void {
  if (!ttsSupported()) return;
  window.speechSynthesis.cancel();
  const clean = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_#>`~[\]()]/g, ' ')
    .slice(0, 3000);
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = lang;
  u.rate = 1.02;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
  return ttsSupported() ? window.speechSynthesis.speaking : false;
}
