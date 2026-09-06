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
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  CLAUDE_MODEL: z.string().default('claude-opus-5'),
  GEMINI_IMAGE_MODEL: z.string().default('gemini-3.1-flash-image'),
  LABOR_LAW_CHECK: z.enum(['auto', 'always', 'off']).default('auto'),
  DATA_DIR: z.string().default('./data'),
  BASMA_MOCK_AI: z.string().optional(),
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

export function requireAnthropicKey(): string {
  const env = getEnv();
  if (env.mockAi) return 'mock';
  if (!env.ANTHROPIC_API_KEY) throw new ConfigError('ANTHROPIC_API_KEY غير مضبوط في ملف .env');
  return env.ANTHROPIC_API_KEY;
}

export function requireGeminiKey(): string {
  const env = getEnv();
  if (env.mockAi) return 'mock';
  if (!env.GEMINI_API_KEY) throw new ConfigError('GEMINI_API_KEY غير مضبوط في ملف .env');
  return env.GEMINI_API_KEY;
}
