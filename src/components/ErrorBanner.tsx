import { McError } from '../types';
import { cn } from '../lib/utils';
import { useI18n } from '../i18n';
import { IconX } from './icons';

export function ErrorBanner({
  error, onRetry, onSwitch, onClose, className,
}: {
  error: Error | null;
  onRetry?: () => void;
  onSwitch?: () => void;
  onClose?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  if (!error) return null;
  const code = error instanceof McError ? error.code : 'server';
  const msg = t(`err.${code}`) === `err.${code}` ? t('err.server') : t(`err.${code}`);
  // Surface the provider's own explanation (e.g. "Insufficient credits: …") —
  // without it users can't tell a wrong key from a credits/region issue.
  const detail = error instanceof McError && error.message && error.message !== error.code ? error.message : '';
  const hasActions = onRetry || onSwitch;
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border border-rose-900/70 bg-rose-950/50 px-4 py-3 text-sm text-rose-100', className)} role="alert">
      <span className="flex-1">
        {msg}
        {detail && <span className="mt-0.5 block break-words text-[11px] leading-snug text-rose-300/85" dir="auto">{detail}</span>}
      </span>
      {hasActions && (
        <span className="flex shrink-0 items-center gap-2">
          {onRetry && (
            <button onClick={onRetry} className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold hover:bg-white/20">
              {t('c.retry')}
            </button>
          )}
          {onSwitch && (
            <button onClick={onSwitch} className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold hover:bg-white/20">
              {t('err.switch')}
            </button>
          )}
        </span>
      )}
      {onClose && (
        <button onClick={onClose} className="shrink-0 rounded-lg p-1 hover:bg-white/10" aria-label={t('c.close')}>
          <IconX className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
