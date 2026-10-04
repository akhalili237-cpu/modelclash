import React, { useEffect, useRef, useState } from 'react';
import { createSTT, sttSupported } from '../lib/voice';
import { cn } from '../lib/utils';
import { IconMic, IconSend, IconStop } from './icons';
import { useI18n } from '../i18n';

export function ChatInput({
  onSend, onStop, busy, placeholder, className, large,
}: {
  onSend: (text: string) => void;
  onStop?: () => void;
  busy?: boolean;
  placeholder?: string;
  className?: string;
  large?: boolean;
}) {
  const { t, lang } = useI18n();
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const sttRef = useRef<ReturnType<typeof createSTT>>(null);

  const resize = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, large ? 220 : 160)}px`;
  };

  useEffect(resize, [text]);

  useEffect(() => {
    const onFocus = () => taRef.current?.focus();
    window.addEventListener('mc:focus-input', onFocus);
    return () => window.removeEventListener('mc:focus-input', onFocus);
  }, []);

  useEffect(() => () => sttRef.current?.stop(), []);

  const submit = () => {
    const v = text.trim();
    if (!v || busy) return;
    onSend(v);
    setText('');
    requestAnimationFrame(resize);
  };

  const toggleMic = () => {
    if (listening) {
      sttRef.current?.stop();
      setListening(false);
      return;
    }
    if (!sttSupported()) { alert(t('voice.unsupported')); return; }
    const ta = taRef.current;
    const base = ta ? ta.value : '';
    let appended = '';
    const handle = createSTT(
      lang,
      (chunk, isFinal) => {
        appended = chunk;
        setText(base + appended);
      },
      () => setListening(false),
    );
    if (!handle) { alert(t('voice.unsupported')); return; }
    sttRef.current = handle;
    setListening(true);
    handle.start();
  };

  return (
    <div className={cn('flex items-end gap-2', className)}>
      <div className="relative flex-1">
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder || t('chat.ph')}
          className={cn(
            'w-full resize-none rounded-2xl border border-line bg-panel2 py-3 ps-4 text-[15px] text-zinc-100',
            'placeholder:text-zinc-600 outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors',
            listening ? 'pe-11' : 'pe-4',
          )}
          dir="auto"
        />
        <button
          onClick={toggleMic}
          title={t('voice.unsupported')}
          className={cn(
            'absolute bottom-2.5 end-2.5 rounded-lg p-1.5 transition-colors',
            listening ? 'bg-rose-600 text-white animate-pulse' : 'text-zinc-500 hover:text-white hover:bg-white/10',
          )}
        >
          <IconMic className="w-5 h-5" />
        </button>
      </div>
      {busy ? (
        <button
          onClick={onStop}
          title={t('c.stop')}
          className="shrink-0 rounded-2xl bg-rose-600 p-3.5 text-white hover:bg-rose-500 transition-colors"
        >
          <IconStop className="w-5 h-5" />
        </button>
      ) : (
        <button
          onClick={submit}
          disabled={!text.trim()}
          title={t('c.send')}
          className="shrink-0 rounded-2xl bg-gradient-to-r from-accent to-accent2 p-3.5 text-white shadow-lg shadow-accent/25 transition-all hover:opacity-90 active:scale-95 disabled:opacity-30 disabled:shadow-none"
        >
          <IconSend className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
