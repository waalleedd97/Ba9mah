import { z } from 'zod';

/**
 * إعدادات البيئة — تُقرأ مرة واحدة وتُتحقق بـ zod.
 * لا نرمي خطأ عند الاستيراد كي لا يفشل `next build` بدون .env؛
 * الدوال التي تحتاج قيمة إلزامية تطلبها عبر requireX().
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_PASSWORD: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  /** نموذج النص الأساسي للكتابة والتعلم والتحليل */
  GEMINI_TEXT_MODEL: z.string().default('gemini-3-flash-preview'),
  /** بدائل تُجرَّب بالترتيب عند ضغط عالٍ أو نفاد حصة النموذج الأساسي */
  GEMINI_TEXT_FALLBACKS: z.string().default('gemini-3.7-flash,gemini-3.1-flash-lite'),
  GEMINI_IMAGE_MODEL: z.string().default('gemini-3.1-flash-image'),
  LABOR_LAW_CHECK: z.enum(['auto', 'always', 'off']).default('auto'),
  DATA_DIR: z.string().default('./data'),
  BASMA_MOCK_AI: z.string().optional(),
  BASMA_BUILD_SHA: z.string().default('dev'),
  BASMA_BUILD_DATE: z.string().default(''),
});

export type Env = z.infer<typeof EnvSchema> & { mockAi: boolean; isProd: boolean };

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  const base = parsed.success ? parsed.data : EnvSchema.parse({});
  cached = {
    ...base,
    mockAi: base.BASMA_MOCK_AI === '1' || base.BASMA_MOCK_AI === 'true',
    isProd: base.NODE_ENV === 'production',
  };
  return cached;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function requireAuthConfig(): { password: string; secret: string } {
  const env = getEnv();
  if (!env.APP_PASSWORD || env.APP_PASSWORD.length < 4) {
    throw new ConfigError('APP_PASSWORD غير مضبوط في ملف .env (4 أحرف على الأقل)');
  }
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) {
    throw new ConfigError('AUTH_SECRET غير مضبوط أو أقصر من 32 حرفاً. أنشئه بـ: openssl rand -hex 32');
  }
  return { password: env.APP_PASSWORD, secret: env.AUTH_SECRET };
}

export function requireGeminiKey(): string {
  const env = getEnv();
  if (env.mockAi) return 'mock';
  if (!env.GEMINI_API_KEY) throw new ConfigError('مفتاح Gemini غير مضبوط: أعد تشغيل سكربت النشر مع --gemini-key');
  return env.GEMINI_API_KEY;
}
