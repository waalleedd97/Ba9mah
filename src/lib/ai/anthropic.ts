import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import { getEnv, requireAnthropicKey, ConfigError } from '@/lib/env';
import { logEvent, type UsageInfo } from '@/lib/db/repo';
import { mockFor } from './mock';

export type AIErrorCode = 'refusal' | 'parse' | 'api' | 'config' | 'ratelimit' | 'auth';

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
export type SystemBlock = Anthropic.Beta.BetaTextBlockParam;
export type UserBlock = Anthropic.Beta.BetaContentBlockParam;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: requireAnthropicKey(),
      maxRetries: 2,
      timeout: 5 * 60 * 1000, // ملي ثانية
    });
  }
  return client;
}

export function systemText(text: string, cache?: '5m' | '1h'): SystemBlock {
  const block: SystemBlock = { type: 'text', text };
  if (cache) block.cache_control = cache === '1h' ? { type: 'ephemeral', ttl: '1h' } : { type: 'ephemeral' };
  return block;
}

export function describeAIError(err: unknown): string {
  if (err instanceof AIError || err instanceof ConfigError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return 'مفتاح ANTHROPIC_API_KEY غير صالح';
  if (err instanceof Anthropic.RateLimitError) return 'تجاوزنا حد الطلبات لدى Anthropic، حاول بعد قليل';
  if (err instanceof Anthropic.APIConnectionError) return 'تعذر الاتصال بخدمة Anthropic';
  if (err instanceof Anthropic.APIError) return `خطأ من Anthropic (${err.status ?? '?'}): ${err.message}`;
  if (err instanceof Error) return err.message;
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

/**
 * نداء واحد لـ Claude بمخرجات منظّمة (JSON مضمون بالـ schema).
 * - التفكير التكيفي مفعّل افتراضياً في Opus 5، ونتحكم بالعمق عبر effort.
 * - fallbacks: "default" يعيد تشغيل الطلب على نموذج بديل لو رفضه مصنّف الأمان.
 */
export async function structuredCall<S extends z.ZodType>(opts: StructuredCallOptions<S>): Promise<StructuredResult<z.infer<S>>> {
  const env = getEnv();
  const started = Date.now();

  if (env.mockAi) {
    const data = opts.schema.parse(mockFor(opts.kind, opts.mockHint)) as z.infer<S>;
    logEvent({ kind: opts.kind, model: 'mock', usage: { input: 0, cached: 0, output: 0 }, durationMs: 0 });
    return { data, usage: { input: 0, cached: 0, output: 0 }, model: 'mock' };
  }

  const base = {
    model: env.CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    messages: [{ role: 'user' as const, content: opts.user }],
    output_config: { effort: opts.effort ?? 'high', format: zodOutputFormat(opts.schema) },
  };

  try {
    let res;
    try {
      res = await getClient().beta.messages.parse({
        ...base,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
    } catch (err) {
      // لو لم يقبل الحساب/النموذج معامل fallbacks نعيد الطلب بدونه
      if (err instanceof Anthropic.BadRequestError && /fallback/i.test(err.message)) {
        res = await getClient().beta.messages.parse(base);
      } else {
        throw err;
      }
    }

    const usage: UsageInfo = {
      input: res.usage.input_tokens,
      cached: res.usage.cache_read_input_tokens ?? 0,
      output: res.usage.output_tokens,
    };
    const durationMs = Date.now() - started;

    if (res.stop_reason === 'refusal') {
      logEvent({ kind: opts.kind, model: res.model, usage, durationMs, ok: false, note: 'refusal' });
      throw new AIError('رفض النموذج هذا الطلب لأسباب أمان', 'refusal');
    }
    if (res.stop_reason === 'max_tokens') {
      logEvent({ kind: opts.kind, model: res.model, usage, durationMs, ok: false, note: 'max_tokens' });
      throw new AIError('الرد أطول من الحد المسموح، حاول مرة أخرى', 'parse');
    }
    if (!res.parsed_output) {
      logEvent({ kind: opts.kind, model: res.model, usage, durationMs, ok: false, note: 'parse_failed' });
      throw new AIError('تعذر قراءة رد النموذج', 'parse');
    }

    logEvent({ kind: opts.kind, model: res.model, usage, durationMs, ok: true });
    return { data: res.parsed_output as z.infer<S>, usage, model: res.model };
  } catch (err) {
    if (err instanceof AIError) throw err;
    logEvent({ kind: opts.kind, model: env.CLAUDE_MODEL, durationMs: Date.now() - started, ok: false, note: describeAIError(err) });
    if (err instanceof Anthropic.AuthenticationError) throw new AIError(describeAIError(err), 'auth');
    if (err instanceof Anthropic.RateLimitError) throw new AIError(describeAIError(err), 'ratelimit');
    if (err instanceof ConfigError) throw new AIError(err.message, 'config');
    throw new AIError(describeAIError(err), 'api');
  }
}

/** كتلة صورة لإرسالها إلى Claude (رؤية) */
export function imageBlock(base64: string, mime: string): UserBlock {
  const media = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mime) ? mime : 'image/png') as
    | 'image/jpeg'
    | 'image/png'
    | 'image/gif'
    | 'image/webp';
  return { type: 'image', source: { type: 'base64', media_type: media, data: base64 } };
}
