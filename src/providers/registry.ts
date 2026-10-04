import type { ChatProvider, ModelInfo } from '../types';
import { pollinations } from './pollinations';
import { openrouter } from './openrouter';
import { groq } from './groq';
import { gemini } from './gemini';
import { webllm, hasWebGPU } from './webllm';

export const PROVIDERS: ChatProvider[] = [pollinations, webllm, openrouter, groq, gemini];

const PROVIDER_LABEL: Record<string, string> = {
  pollinations: 'Pollinations · free',
  webllm: 'Local · WebGPU',
  openrouter: 'OpenRouter · key',
  groq: 'Groq · key',
  gemini: 'Gemini · key',
};

export function providerLabel(pid: string): string {
  return PROVIDER_LABEL[pid] || pid;
}

export function providerOf(modelId: string): ChatProvider {
  const pid = modelId.split('/')[0];
  return PROVIDERS.find((p) => p.id === pid) || pollinations;
}

export function getModel(modelId: string, custom = ''): ModelInfo | undefined {
  return allModelsPlus(custom).find((m) => m.id === modelId);
}

/** Default zero-setup model — guaranteed to exist and to work without keys. */
export const DEFAULT_MODEL_ID = 'pollinations/openai-fast';

/**
 * Resolve a saved/remembered model id into a model that can actually run.
 * Catalogs refresh live, so a previously picked id may vanish — falling back
 * beats a silent "nothing happens when I press send". Custom models (user-
 * defined ids) count as existing while their spec is present.
 */
export function resolveModel(modelId?: string, custom = ''): ModelInfo {
  if (modelId) {
    const m = getModel(modelId, custom);
    if (m) return m;
  }
  return getModel(DEFAULT_MODEL_ID) || keylessModels()[0] || allModels()[0];
}

/** Models whose provider is usable right now (keyless or key already saved). */
export function usableModels(custom: string): ModelInfo[] {
  const has = (pid: string) =>
    pid === 'pollinations' || pid === 'webllm' ? true : getKeyExists(pid);
  const list = allModelsPlus(custom).filter((m) => has(m.providerId));
  return list.length >= 2 ? list : allModelsPlus(custom).filter((m) => m.providerId === 'pollinations' || m.providerId === 'webllm');
}

/** All selectable models. Local models only appear when WebGPU exists. */
export function allModels(): ModelInfo[] {
  const out: ModelInfo[] = [];
  for (const p of PROVIDERS) {
    if (p.id === 'webllm' && !hasWebGPU()) continue;
    out.push(...p.models);
  }
  return out;
}

/** Models usable without any key (default zero-setup set). */
export function keylessModels(): ModelInfo[] {
  return allModels().filter((m) => m.providerId === 'pollinations' || m.providerId === 'webllm');
}

/** Parse user-defined custom models: lines like "groq/my-model-id" */
export function customModels(spec: string): ModelInfo[] {
  const out: ModelInfo[] = [];
  for (const line of (spec || '').split('\n')) {
    const s = line.trim();
    if (!s || !s.includes('/')) continue;
    const [pid, ...rest] = s.split('/');
    const provider = PROVIDERS.find((p) => p.id === pid);
    const model = rest.join('/');
    if (!provider || !model) continue;
    out.push({
      id: `${pid}/${model}`,
      model,
      name: model,
      providerId: pid,
      badge: '✎',
    });
  }
  return out;
}

export function allModelsPlus(custom: string): ModelInfo[] {
  return [...allModels(), ...customModels(custom)];
}

/** Kick off async catalog refreshes once at app start. `onReady` fires when they settle. */
export function bootstrapProviders(onReady?: () => void): void {
  const jobs: Promise<void>[] = [];
  if (pollinations.refreshModels) jobs.push(pollinations.refreshModels());
  if (getKeyExists('openrouter') && openrouter.refreshModels) jobs.push(openrouter.refreshModels());
  Promise.allSettled(jobs).then(() => onReady?.());
}

/** Re-run catalog refreshes (e.g. right after the user saves an API key). */
export async function refreshCatalogs(): Promise<void> {
  const jobs: Promise<void>[] = [];
  if (pollinations.refreshModels) jobs.push(pollinations.refreshModels());
  if (getKeyExists('openrouter') && openrouter.refreshModels) jobs.push(openrouter.refreshModels());
  await Promise.allSettled(jobs);
}

function getKeyExists(pid: string): boolean {
  try {
    const k = JSON.parse(localStorage.getItem('mc.keys') || '{}');
    return !!k[pid];
  } catch { return false; }
}
