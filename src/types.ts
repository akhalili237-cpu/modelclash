/* ── ModelClash core types ─────────────────────────────────────────── */

export interface ModelInfo {
  /** unique id: "provider/model" */
  id: string;
  /** raw model id used by the provider API */
  model: string;
  /** display name */
  name: string;
  providerId: string;
  /** short badge shown next to the name, e.g. ⚡ */
  badge?: string;
  free?: boolean;
  /** human note, e.g. "880 MB download" for local models */
  note?: string;
  /** model rejects temperature/top_p (e.g. OpenAI GPT-5 / o-series) — provider omits them */
  noTemp?: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatParams {
  model: ModelInfo;
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  /** called for every streamed token */
  onToken: (t: string) => void;
  signal?: AbortSignal;
  /** provider may report progress like "busy" (429 retrying) or "fallback" */
  onStatus?: (s: string) => void;
}

export interface ChatProvider {
  id: string;
  name: string;
  requiresKey: boolean;
  models: ModelInfo[];
  chat(p: ChatParams): Promise<string>;
  refreshModels?(): Promise<void>;
}

export type McErrCode =
  | 'busy'      // 429 rate limit
  | 'key'       // 401 — invalid/missing key (NOT a credits issue)
  | 'credits'   // 402 — key VALID, model needs paid credits
  | 'forbidden' // 403 — provider refused (region / moderation), key may be fine
  | 'server'    // 5xx / unknown http
  | 'network'   // fetch / CORS
  | 'timeout'   // idle 90 s
  | 'stream'    // stream broke mid-way
  | 'local'     // web-llm failure
  | 'abort'     // user pressed stop
  | 'none';     // empty completion

export class McError extends Error {
  code: McErrCode;
  /** false = deterministic failure (bad key, unknown model, bad params) — never auto-retry */
  retryable: boolean;
  constructor(code: McErrCode, msg?: string, retryable = true) {
    super(msg || code);
    this.name = 'McError';
    this.code = code;
    this.retryable = retryable;
  }
}

/* ── ELO ───────────────────────────────────────────────────────────── */

export type Cat = 'general' | 'coding' | 'creative' | 'math' | 'reasoning' | 'image';
export const CATS: Cat[] = ['general', 'coding', 'creative', 'math', 'reasoning', 'image'];

export interface EloRec {
  r: number; // rating
  g: number; // games
  w: number; // wins
  l: number; // losses
  d: number; // draws
}
export interface EloStats {
  global: EloRec;
  cats: Partial<Record<Cat, EloRec>>;
}
export type EloStore = Record<string, EloStats>;
