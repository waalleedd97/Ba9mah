import { handle, ok, HttpError } from '@/lib/api';
import { countByRating, latestProfile, listProfiles } from '@/lib/db/repo';
import { isLearning, ratingsSinceProfile, relearnProfile } from '@/lib/ai/learn';

export const dynamic = 'force-dynamic';

export const GET = handle(async () =>
  ok({ profile: latestProfile(), history: listProfiles(10), ratingsSince: ratingsSinceProfile(), learning: isLearning() }),
);

/** إعادة استخلاص ملف الأسلوب يدوياً */
export const POST = handle(async () => {
  if (countByRating('liked') < 3) throw new HttpError(409, 'نحتاج 3 بوستات معجَب بها على الأقل');
  const profile = await relearnProfile('manual');
  if (!profile) throw new HttpError(409, 'لا توجد بيانات كافية للتعلم');
  return ok({ profile });
});
