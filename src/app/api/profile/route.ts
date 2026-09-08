import { handle, ok, HttpError } from '@/lib/api';
import { countByRating, latestProfile, listProfiles } from '@/lib/db/repo';
import { isLearning, ratingsSinceProfile, relearnProfile } from '@/lib/ai/learn';

export const dynamic = 'force-dynamic';

export const GET = handle(async () =>
  ok({ profile: latestProfile(), history: listProfiles(10), ratingsSince: ratingsSinceProfile(), learning: isLearning() }),
);

/**
 * إعادة استخلاص ملف الأسلوب يدوياً.
 * جسم اختياري { fresh: true } يستخلصه من الصفر بلا وراثة الملف السابق (عندما يكون السابق قد انحرف).
 */
export const POST = handle(async (req) => {
  if (countByRating('liked') < 3) throw new HttpError(409, 'نحتاج 3 بوستات معجَب بها على الأقل');
  const body = (await req.json().catch(() => ({}))) as { fresh?: unknown };
  const profile = await relearnProfile('manual', { fresh: body?.fresh === true });
  if (!profile) throw new HttpError(409, 'لا توجد بيانات كافية للتعلم');
  return ok({ profile });
});
