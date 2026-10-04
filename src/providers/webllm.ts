import { McError, type ChatParams, type ChatProvider, type ModelInfo } from '../types';

/**
 * Tier 1 — Local WebGPU models via @mlc-ai/web-llm running in a Web Worker.
 * Fully offline after first download; nothing leaves the device.
 * Disabled (hidden) when navigator.gpu is missing.
 */

export const LOCAL_MODELS: ModelInfo[] = [
  { id: 'webllm/Llama-3.2-1B-Instruct-q4f32_1-MLC', model: 'Llama-3.2-1B-Instruct-q4f32_1-MLC', name: 'Llama 3.2 1B · local', providerId: 'webllm', free: true, badge: '🔒', note: '~0.9 GB download' },
  { id: 'webllm/Qwen2.5-0.5B-Instruct-q4f16_1-MLC', model: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', name: 'Qwen2.5 0.5B · local', providerId: 'webllm', free: true, badge: '🔒', note: '~0.5 GB download' },
  { id: 'webllm/Qwen2.5-1.5B-Instruct-q4f16_1-MLC', model: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', name: 'Qwen2.5 1.5B · local', providerId: 'webllm', free: true, badge: '🔒', note: '~1.0 GB download' },
  { id: 'webllm/TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC', model: 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC', name: 'TinyLlama 1.1B · local', providerId: 'webllm', free: true, badge: '🔒', note: '~0.6 GB download' },
];

export const webllmState = {
  ready: false,
  model: '' as string,
  loading: false,
  progress: '' as string,
};

type Engine = any;
let engine: Engine | null = null;
let engineModel = '';
let loadPromise: Promise<Engine> | null = null;

export function hasWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator && !!(navigator as any).gpu;
}

export async function ensureEngine(modelId: string, onProgress?: (t: string) => void): Promise<Engine> {
  if (engine && engineModel === modelId) return engine;
  if (loadPromise && engineModel === modelId) return loadPromise;

  if (engine) {
    try { await engine.unload(); } catch { /* noop */ }
    engine = null;
  }

  loadPromise = (async () => {
    const mod: any = await import('@mlc-ai/web-llm');
    const worker = new Worker(new URL('../workers/webllm.worker.ts', import.meta.url), { type: 'module' });
    const eng = await mod.CreateWebWorkerMLCEngine(worker, modelId, {
      initProgressCallback: (r: any) => {
        webllmState.progress = String(r?.text || '');
        onProgress?.(webllmState.progress);
      },
    });
    engine = eng;
    engineModel = modelId;
    loadPromise = null;
    webllmState.ready = true;
    webllmState.model = modelId;
    webllmState.loading = false;
    return eng;
  })();

  webllmState.loading = true;
  try {
    return await loadPromise;
  } catch (e) {
    loadPromise = null;
    webllmState.loading = false;
    webllmState.ready = false;
    const msg = String((e as Error)?.message || e);
    if (/out of memory|OOM|allocat|VRAM/i.test(msg)) throw new McError('local', msg);
    if (/WebGPU/i.test(msg)) throw new McError('local', 'WebGPU unavailable');
    throw new McError('local', msg);
  }
}

export function isLocalModel(id: string): boolean {
  return id.startsWith('webllm/');
}

async function chat(p: ChatParams): Promise<string> {
  let eng: Engine;
  try {
    eng = await ensureEngine(p.model.model, (t) => p.onStatus?.(`progress:${t}`));
  } catch (e) {
    if (e instanceof McError) throw e;
    throw new McError('local', String((e as Error)?.message || e));
  }

  const msgs: any[] = [];
  const sys = (p.systemPrompt || '').trim();
  if (sys) msgs.push({ role: 'system', content: sys });
  for (const m of p.messages) {
    if (m.role === 'system') continue;
    if (m.role === 'assistant' && !m.content.trim()) continue;
    msgs.push({ role: m.role, content: m.content });
  }

  try {
    const chunks = await eng.chat.completions.create({
      messages: msgs,
      stream: true,
      stream_options: { include_usage: true },
      temperature: p.temperature ?? 0.8,
      max_tokens: p.maxTokens ?? 2048,
    });
    let text = '';
    for await (const chunk of chunks) {
      const delta = chunk?.choices?.[0]?.delta?.content || '';
      if (delta) {
        text += delta;
        p.onToken(delta);
      }
      if (p.signal?.aborted) {
        try { await eng.interruptGenerate(); } catch { /* noop */ }
        throw new McError('abort');
      }
    }
    return text;
  } catch (e) {
    if (e instanceof McError) throw e;
    if (p.signal?.aborted) throw new McError('abort');
    const msg = String((e as Error)?.message || e);
    if (/out of memory|OOM|allocat|VRAM/i.test(msg)) throw new McError('local', msg);
    throw new McError('local', msg);
  }
}

export const webllm: ChatProvider = {
  id: 'webllm',
  name: 'Local (WebGPU)',
  requiresKey: false,
  models: LOCAL_MODELS,
  chat,
};
