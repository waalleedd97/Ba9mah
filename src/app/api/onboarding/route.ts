import { z } from 'zod';
import { handle, ok, readJson, HttpError } from '@/lib/api';
import { isOnboarded } from '@/lib/db/repo';
import { completeOnboarding } from '@/lib/onboarding';
import { relearnProfile } from '@/lib/ai/learn';

const Body = z.object({
  spec: z.string().trim().min(2).max(120),
  samples: z.array(z.string().max(8000)).max(500).default([]),
  voice: z.array(z.string().max(30)).max(4).default([]),
  language: z.string().max(30).nullable().optional(),
  avoid: z.array(z.string().max(30)).max(12).default([]),
});

export const POST = handle(async (req) => {
  if (isOnboarded()) throw new HttpError(409, 'تم الإعداد مسبقاً. استخدم إعادة التعيين من الإعدادات');
  const body = await readJson(req, Body);
  const { samples } = completeOnboarding({ ...body, language: body.language ?? null });
  let profile = false;
  if (samples > 0) {
    // بصمة أولى من نصوص المستخدم قبل أول جولة
    try {
      profile = Boolean(await relearnProfile('manual', { force: true }));
    } catch (err) {
      console.error('[onboarding] initial profile failed:', err instanceof Error ? err.message : err);
    }
  }
  return ok({ ok: true, samples, profile });
});
