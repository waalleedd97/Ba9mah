import 'server-only';
import {
  countByRating,
  countRatedSince,
  getSetting,
  getSpec,
  insertProfile,
  latestProfile,
  listDislikedWithReasons,
  listPostsByRating,
  ruleTexts,
  setSetting,
} from '@/lib/db/repo';
import type { StyleProfile } from '@/lib/types';
import { structuredCall, systemText } from './anthropic';
import { StyleProfileSchema } from './schemas';
import { LEARN_SYSTEM, buildLearnUser, renderProfileMarkdown } from './prompts';

/** الحد الأدنى من التقييمات الجديدة قبل إعادة استخلاص الملف تلقائياً */
export const MIN_NEW_RATINGS = 3;
const MIN_LIKED_FOR_PROFILE = 3;

let inflight: Promise<StyleProfile | null> | null = null;

/** كم تقييم (غير البذرة) حدث بعد آخر ملف؟ */
export function ratingsSinceProfile(): number {
  const prof = latestProfile();
  return countRatedSince(prof?.createdAt ?? 0);
}

export function relearnIsDue(): boolean {
  if (countByRating('liked') < MIN_LIKED_FOR_PROFILE) return false;
  return ratingsSinceProfile() >= MIN_NEW_RATINGS;
}

/** استخلاص ملف أسلوب جديد من كل البيانات (يُنفَّذ مرة واحدة في كل لحظة) */
export async function relearnProfile(trigger: 'auto' | 'manual'): Promise<StyleProfile | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const spec = getSpec();
      const liked = listPostsByRating('liked', 40);
      if (!spec || liked.length < MIN_LIKED_FOR_PROFILE) return null;
      const disliked = listDislikedWithReasons(20);
      const previous = latestProfile();
      setSetting('learning_started_at', String(Date.now()));

      const { data } = await structuredCall({
        kind: 'learn',
        schema: StyleProfileSchema,
        system: [systemText(LEARN_SYSTEM)],
        user: buildLearnUser({
          spec,
          liked,
          disliked,
          goldenRules: ruleTexts('golden'),
          avoidRules: ruleTexts('avoid'),
          previous,
        }),
        effort: 'high',
        maxTokens: 8000,
      });

      const profile = insertProfile({
        markdown: renderProfileMarkdown(data),
        data,
        likedCount: liked.length,
        dislikedCount: disliked.length,
      });
      setSetting('last_learn_trigger', trigger);
      console.log(`[learn] profile v${profile.version} (${trigger}) from ${liked.length} liked / ${disliked.length} disliked`);
      return profile;
    } finally {
      setSetting('learning_started_at', '');
      inflight = null;
    }
  })();
  return inflight;
}

export async function maybeRelearn(): Promise<void> {
  if (!relearnIsDue()) return;
  try {
    await relearnProfile('auto');
  } catch (err) {
    console.error('[learn] auto relearn failed:', err instanceof Error ? err.message : err);
  }
}

export function isLearning(): boolean {
  const v = getSetting('learning_started_at');
  if (!v) return false;
  // حماية من قفل عالق لو انتهت العملية بدون تنظيف
  return Date.now() - Number(v) < 10 * 60 * 1000;
}
