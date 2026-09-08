import 'server-only';
import { ApiError, GoogleGenAI, ThinkingLevel, type GenerateContentResponse, type Part } from '@google/genai';
import { z } from 'zod';
import { getEnv, requireGeminiKey, ConfigError } from '@/lib/env';
import { logEvent, type UsageInfo } from '@/lib/db/repo';
import { mockFor } from './mock';

export type AIErrorCode = 'refusal' | 'parse' | 'api' | 'config' | 'ratelimit' | 'auth' | 'unavailable';

export class AIError extends Error {
  constructor(
    message: string,
    public readonly code: AIErrorCode,
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
/** كتلة نظام. Gemini يخزّن البادئة الثابتة تلقائياً (implicit caching) فنضع الثابت أولاً */
export interface SystemBlock {
  text: string;
}
export type UserBlock = Part;

let client: GoogleGenAI | null = null;

/** عميل Gemini المشترك بين النص والصور */
export function getGeminiClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: requireGeminiKey() });
  return client;
}

export function systemText(text: string, _cache?: '5m' | '1h'): SystemBlock {
  return { text };
}

/** كتلة صورة لإرسالها إلى Gemini (رؤية) */
export function imageBlock(base64: string, mime: string): UserBlock {
  const mimeType = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mime) ? mime : 'image/png';
  return { inlineData: { data: base64, mimeType } };
}

/** نماذج النص بالترتيب: الأساسي ثم البدائل عند الضغط العالي أو نفاد الحصة */
export function textModelChain(): string[] {
  const env = getEnv();
  const list = [env.GEMINI_TEXT_MODEL, ...env.GEMINI_TEXT_FALLBACKS.split(',')].map((s) => s.trim()).filter(Boolean);
  return [...new Set(list)];
}

/** نموذج رُفض مؤقتاً (503/429/404 أو تجاوز المهلة) يُتخطى خمس دقائق بدل تكرار الانتظار في كل نداء */
const unavailableUntil = new Map<string, number>();
const COOLDOWN_MS = 5 * 60 * 1000;

function thinkingLevel(effort: Effort): ThinkingLevel {
  if (effort === 'low') return ThinkingLevel.LOW;
  if (effort === 'medium') return ThinkingLevel.MEDIUM;
  return ThinkingLevel.HIGH;
}

/** JSON Schema من zod مع إزالة ما لا يقبله Gemini */
function toJsonSchema(schema: z.ZodType): unknown {
  return sanitize(z.toJSONSchema(schema));
}
function sanitize(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitize);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === '$schema' || k === 'additionalProperties') continue;
      if ((k === 'maximum' || k === 'minimum') && typeof v === 'number' && Math.abs(v) > 1e15) continue;
      out[k] = sanitize(v);
    }
    return out;
  }
  return node;
}

export function statusOf(err: unknown): number | null {
  if (err instanceof ApiError) return err.status;
  const m = err instanceof Error ? /\b(4\d\d|5\d\d)\b/.exec(err.message) : null;
  return m ? Number(m[1]) : null;
}

export function describeAIError(err: unknown, model?: string): string {
  if (err instanceof AIError || err instanceof ConfigError) return err.message;
  if (isAbortError(err)) return `انتهت مهلة الاتصال بـ Gemini${model ? ` (${model})` : ''}، حاول مرة أخرى بعد قليل`;
  const status = statusOf(err);
  const msg = err instanceof Error ? err.message : String(err);
  if (status === 401 || status === 403 || /API key not valid|API_KEY_INVALID/i.test(msg)) return 'مفتاح Gemini غير صالح أو غير مفعّل';
  if (status === 429) return 'تجاوزنا حصة Gemini الحالية. انتظر دقيقة، أو فعّل الفوترة في Google AI Studio لرفع الحد';
  if (status === 404) return `النموذج ${model ?? ''} غير متاح لحسابك`.replace('  ', ' ');
  if (status === 503) return 'Gemini تحت ضغط عالٍ الآن، حاول بعد قليل';
  if (status === 400) return `طلب رفضه Gemini: ${msg.slice(0, 200)}`;
  if (err instanceof Error) return msg.slice(0, 300);
  return 'خطأ غير متوقع';
}

export interface StructuredCallOptions<S extends z.ZodType> {
  /** اسم العملية للسجل: generate | learn | analyze_dislike | ... */
  kind: string;
  schema: S;
  system: string | SystemBlock[];
  user: string | UserBlock[];
  effort?: Effort;
  maxTokens?: number;
  /** تلميح للوضع الوهمي فقط */
  mockHint?: string;
}

export interface StructuredResult<T> {
  data: T;
  usage: UsageInfo;
  model: string;
}

const REFUSAL_REASONS = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY']);

function usageOf(res: GenerateContentResponse): UsageInfo {
  const u = res.usageMetadata;
  return {
    input: u?.promptTokenCount ?? 0,
    cached: u?.cachedContentTokenCount ?? 0,
    output: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0),
  };
}

function extractJson(text: string): string {
  const t = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return fenced ? fenced[1] : t;
}

/**
 * مهلة المحاولة الواحدة داخل الـ SDK (ميلي ثانية). الرد الطبيعي للكتابة والتعلم 10 إلى 30 ثانية؛
 * ما يتجاوز 45 ثانية يكون نموذجاً مزدحماً يُحسن تركه للبديل بدل الانتظار.
 */
const ATTEMPT_TIMEOUT_MS = 45 * 1000;
/** سقف زمني إجمالي لكل نموذج شاملاً إعادة المحاولة؛ بعده نلغي النداء وننتقل للنموذج البديل */
export const MODEL_DEADLINE_MS = 60 * 1000;

/** إلغاء بسبب المهلة (AbortSignal.timeout يرمي TimeoutError، والإلغاء اليدوي AbortError) */
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
}

interface RawCall {
  model: string;
  systemInstruction: string;
  parts: Part[];
  jsonSchema: unknown;
  maxOutputTokens: number;
  effort: Effort;
  signal: AbortSignal;
}

async function rawGenerate(c: RawCall): Promise<GenerateContentResponse> {
  const base = {
    model: c.model,
    contents: [{ role: 'user' as const, parts: c.parts }],
    config: {
      systemInstruction: c.systemInstruction,
      responseMimeType: 'application/json',
      responseJsonSchema: c.jsonSchema,
      maxOutputTokens: c.maxOutputTokens,
      // السقف الإجمالي للنموذج: يوقف المحاولة الجارية ويمنع أي إعادة محاولة بعده
      abortSignal: c.signal,
      httpOptions: {
        timeout: ATTEMPT_TIMEOUT_MS,
        // تنبيه: initialDelay و maxDelay هنا بالثواني لا بالميلي ثانية.
        // تمرير 1000 و6000 كان يعني انتظار 16 إلى 100 دقيقة بين المحاولات عند أي 503 عابر.
        // محاولة إعادة واحدة تكفي: البدائل في السلسلة أسرع من تكرار الطرق على نموذج مزدحم.
        retryOptions: { attempts: 2, initialDelay: 1, maxDelay: 6, httpStatusCodes: [408, 500, 502, 503, 504] },
      },
    },
  };
  try {
    return await getGeminiClient().models.generateContent({
      ...base,
      config: { ...base.config, thinkingConfig: { thinkingLevel: thinkingLevel(c.effort) } },
    });
  } catch (err) {
    // نموذج لا يقبل مستوى التفكير المطلوب → نعيد الطلب بالإعداد الافتراضي
    if (statusOf(err) === 400 && /thinking/i.test(String(err))) return getGeminiClient().models.generateContent(base);
    throw err;
  }
}

/**
 * نداء واحد لـ Gemini بمخرجات منظّمة (JSON مطابق للـ schema).
 * - التفكير يُضبط بمستوى effort لكل مسار.
 * - عند 503/429/404 ينتقل تلقائياً للنموذج البديل التالي في السلسلة.
 */
export async function structuredCall<S extends z.ZodType>(opts: StructuredCallOptions<S>): Promise<StructuredResult<z.infer<S>>> {
  const env = getEnv();

  if (env.mockAi) {
    const data = opts.schema.parse(mockFor(opts.kind, opts.mockHint)) as z.infer<S>;
    logEvent({ kind: opts.kind, model: 'mock', usage: { input: 0, cached: 0, output: 0 }, durationMs: 0 });
    return { data, usage: { input: 0, cached: 0, output: 0 }, model: 'mock' };
  }

  const systemInstruction = typeof opts.system === 'string' ? opts.system : opts.system.map((b) => b.text).join('\n\n');
  const parts: Part[] = typeof opts.user === 'string' ? [{ text: opts.user }] : opts.user;
  const jsonSchema = toJsonSchema(opts.schema);
  // توكنات التفكير تُحسب ضمن حد الإخراج → هامش إضافي
  const maxOutputTokens = Math.min(65536, (opts.maxTokens ?? 16000) + 8192);
  const effort = opts.effort ?? 'high';

  let lastErr: unknown = null;
  let lastModel = env.GEMINI_TEXT_MODEL;
  for (const model of textModelChain()) {
    if ((unavailableUntil.get(model) ?? 0) > Date.now()) continue;
    lastModel = model;
    const started = Date.now();
    const signal = AbortSignal.timeout(MODEL_DEADLINE_MS);
    try {
      const res = await rawGenerate({ model, systemInstruction, parts, jsonSchema, maxOutputTokens, effort, signal });
      const usage = usageOf(res);
      const durationMs = Date.now() - started;
      const cand = res.candidates?.[0];
      const finish = String(cand?.finishReason ?? '');

      if (res.promptFeedback?.blockReason || REFUSAL_REASONS.has(finish)) {
        logEvent({ kind: opts.kind, model, usage, durationMs, ok: false, note: `refusal:${res.promptFeedback?.blockReason ?? finish}` });
        throw new AIError('رفض النموذج هذا الطلب لأسباب أمان', 'refusal');
      }
      const text = (cand?.content?.parts ?? [])
        .filter((p) => p.text && !p.thought)
        .map((p) => p.text)
        .join('');
      if (finish === 'MAX_TOKENS') {
        logEvent({ kind: opts.kind, model, usage, durationMs, ok: false, note: 'max_tokens' });
        throw new AIError('الرد أطول من الحد المسموح، حاول مرة أخرى', 'parse');
      }
      let data: z.infer<S>;
      try {
        data = opts.schema.parse(JSON.parse(extractJson(text))) as z.infer<S>;
      } catch {
        logEvent({ kind: opts.kind, model, usage, durationMs, ok: false, note: `parse_failed:${text.slice(0, 120)}` });
        throw new AIError('تعذر قراءة رد النموذج', 'parse');
      }
      logEvent({ kind: opts.kind, model, usage, durationMs, ok: true });
      console.log(`[gemini] ${opts.kind} ok model=${model} ${(durationMs / 1000).toFixed(1)}s in=${usage.input} out=${usage.output}`);
      return { data, usage, model };
    } catch (err) {
      if (err instanceof AIError) throw err;
      const status = statusOf(err);
      const timedOut = signal.aborted || isAbortError(err);
      const note = timedOut ? `تجاوز النموذج ${model} السقف الزمني (${Math.round(MODEL_DEADLINE_MS / 1000)} ثانية)` : describeAIError(err, model);
      logEvent({ kind: opts.kind, model, durationMs: Date.now() - started, ok: false, note });
      console.warn(`[gemini] ${opts.kind} failed model=${model} status=${status ?? '?'} ${((Date.now() - started) / 1000).toFixed(1)}s: ${note}`);
      if (err instanceof ConfigError) throw new AIError(err.message, 'config');
      if (status === 401 || status === 403) throw new AIError(note, 'auth');
      if (timedOut || status === 404 || status === 429 || status === 500 || status === 503) {
        unavailableUntil.set(model, Date.now() + COOLDOWN_MS);
        lastErr = err;
        continue;
      }
      throw new AIError(note, 'api');
    }
  }
  const status = statusOf(lastErr);
  throw new AIError(lastErr ? describeAIError(lastErr, lastModel) : 'لا يوجد نموذج نص متاح الآن، حاول بعد دقيقة', status === 429 ? 'ratelimit' : 'unavailable');
}
