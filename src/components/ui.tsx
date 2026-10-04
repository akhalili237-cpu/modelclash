import React, { useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import { IconX, IconCopy } from './icons';
import { useI18n } from '../i18n';

/* ── buttons ───────────────────────────────────────────────────────── */

export function Btn({
  children, onClick, variant = 'ghost', disabled, className, title, type,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'outline' | 'danger' | 'gold';
  disabled?: boolean;
  className?: string;
  title?: string;
  type?: 'button' | 'submit';
}) {
  const styles = {
    primary: 'bg-gradient-to-r from-accent to-accent2 text-white hover:opacity-90 shadow-lg shadow-accent/20',
    gold: 'bg-gold text-ink hover:brightness-110 font-bold',
    ghost: 'bg-panel2 hover:bg-line text-zinc-200 border border-line',
    outline: 'border border-line hover:border-zinc-500 text-zinc-300 hover:text-white',
    danger: 'bg-rose-950/60 border border-rose-900 text-rose-200 hover:bg-rose-900/60',
  }[variant];
  return (
    <button
      type={type || 'button'}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all active:scale-[.98]',
        'disabled:opacity-40 disabled:pointer-events-none',
        styles, className,
      )}
    >
      {children}
    </button>
  );
}

export function Chip({
  children, active, onClick, className,
}: { children: React.ReactNode; active?: boolean; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors',
        active
          ? 'bg-accent/15 border-accent/60 text-orange-200'
          : 'bg-panel2/60 border-line text-zinc-400 hover:text-zinc-200 hover:border-zinc-600',
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ── layout helpers ────────────────────────────────────────────────── */

export function PageHeader({ title, desc, right }: { title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">{title}</h1>
        {desc && <p className="mt-1 text-sm text-zinc-400 max-w-2xl">{desc}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function Card({ children, className, glow }: { children: React.ReactNode; className?: string; glow?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-panel/80 backdrop-blur',
        glow ? 'border-accent/40 shadow-[0_0_40px_-12px] shadow-accent/30' : 'border-line',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── modal ─────────────────────────────────────────────────────────── */

export function Modal({
  open, onClose, title, children, wide,
}: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={ref}
        className={cn(
          'relative w-full rounded-t-2xl sm:rounded-2xl border border-line bg-panel shadow-2xl',
          'max-h-[90vh] flex flex-col animate-fade-up',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-bold text-white">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-panel2" aria-label={t('c.close')}>
            <IconX className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ── misc ──────────────────────────────────────────────────────────── */

export function Spinner({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <span className={cn('inline-block animate-spin rounded-full border-2 border-zinc-600 border-t-accent', className)} />
  );
}

export function CopyBtn({ text, className }: { text: string; className?: string }) {
  const { t } = useI18n();
  const [done, setDone] = React.useState(false);
  return (
    <button
      title={t('c.copy')}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className={cn('rounded-lg p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 transition-colors', className)}
    >
      {done ? <span className="text-[10px] font-bold text-emerald-400">{t('c.copied')}</span> : <IconCopy className="w-4 h-4" />}
    </button>
  );
}
