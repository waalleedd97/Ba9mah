import { z } from 'zod';
import { handle, ok, readJson, HttpError } from '@/lib/api';
import { isOnboarded } from '@/lib/db/repo';
import { completeOnboarding } from '@/lib/onboarding';
import { ONBOARD_QUESTIONS } from '@/lib/seed';

const Body = z.object({
  spec: z.string().trim().min(2).max(80),
  choices: z.array(z.enum(['a', 'b'])).length(ONBOARD_QUESTIONS.length),
});

export const POST = handle(async (req) => {
  if (isOnboarded()) throw new HttpError(409, 'تم الإعداد مسبقاً. استخدم إعادة التعيين من الإعدادات');
  const { spec, choices } = await readJson(req, Body);
  completeOnboarding(spec, choices);
  return ok({ ok: true });
});
