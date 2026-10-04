import { McError, type ChatParams, type ChatProvider } from '../types';

/** Idle timeout — reset on every token. */
const IDLE_MS = 90_000;
const BUSY_RETRIES = 2;
const BUSY_WAIT = 5_000;

export interface ResilienceEvents {
  onBusy?: (attempt: number) => void;
  onFallback?: () => void;
}

/**
 * Wraps a provider call with ModelClash's resilience policy:
 *  - 90 s idle timeout (friendly "timeout" error, never hangs)
 *  - 429 "free tier busy" → banner + auto retry ×2 with 5 s backoff
 *  - user stop is always honoured
 *  - errors before the first token are retryable; after that they surface
 */
export async function chatWithResilience(
  provider: ChatProvider,
  p: ChatParams,
  ev: ResilienceEvents = {},
): Promise<string> {
  const userSig = p.signal;
  const ctrl = new AbortController();
  const onUserAbort = () => ctrl.abort();
  userSig?.addEventListener('abort', onUserAbort);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => { timer = setTimeout(() => ctrl.abort(new DOMException('idle timeout', 'TimeoutError')), IDLE_MS); };
  const disarm = () => { if (timer) clearTimeout(timer); };

  let gotToken = false;
  const onToken = (t: string) => { gotToken = true; disarm(); arm(); p.onToken(t); };
  const onStatus = (s: string) => { if (s === 'fallback') ev.onFallback?.(); p.onStatus?.(s); };

  const attempt = () =>
    provider.chat({ ...p, onToken, onStatus, signal: ctrl.signal });

  arm();
  try {
    try {
      return await attempt();
    } catch (e) {
      const err = e instanceof McError ? e : new McError('server', String((e as Error)?.message || e));
      if (err.code === 'abort') {
        if (userSig?.aborted) throw new McError('abort');
        throw new McError('timeout');
      }
      const retryable = !gotToken && err.retryable !== false && (err.code === 'busy' || err.code === 'server' || err.code === 'network');
      if (retryable) {
        for (let i = 1; i <= BUSY_RETRIES; i++) {
          if (err.code === 'busy') ev.onBusy?.(i);
          await new Promise((r) => setTimeout(r, BUSY_WAIT));
          if (userSig?.aborted) throw new McError('abort');
          try {
            return await attempt();
          } catch (e2) {
            const err2 = e2 instanceof McError ? e2 : new McError('server', String((e2 as Error)?.message || e2));
            if (err2.code === 'abort') {
              if (userSig?.aborted) throw new McError('abort');
              throw new McError('timeout');
            }
            if (!gotToken && err2.retryable !== false && (err2.code === 'busy' || err2.code === 'server' || err2.code === 'network')) {
              continue; // try again
            }
            throw err2;
          }
        }
      }
      throw err;
    }
  } finally {
    disarm();
    userSig?.removeEventListener('abort', onUserAbort);
  }
}
