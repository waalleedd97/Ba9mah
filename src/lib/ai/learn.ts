import 'server-only';
import {
  countByKind,
  countByRating,
  countRatedSince,
  getSetting,
  getSpec,
  insertProfile,
  latestProfile,
  listDislikedWithReasons,
  listLikedNonOwn,
  listOwnPostsSample,
  ruleTexts,
  setSetting,
} from '@/lib/db/repo';
import type { StyleProfile } from '@/lib/types';
import { structuredCall, systemText } from './gemini';
import { StyleProfileSchema } from './schemas';
import { LEARN_SYSTEM, buildLearnUser, buildOwnCorpusBlock, renderProfileMarkdown } from './prompts';

/** الحد الأدنى من التقييمات الجديدة قبل إعادة استخلاص الملف تلقائياً */
export const MIN_NEW_RATINGS = 3;
const MIN_LIKED_FOR_PROFILE = 3;
/** أقصى عدد من نصوص المستخدم يُرسل للتحليل (عيّنة ممثلة) */
export const OWN_SAMPLE_MAX = 60;

let inflight: Promise<StyleProfile | null> | null = null;

export function ratingsSinceProfile(): number {
  const prof = latestProfile();
  return countRatedSince(prof?.createdAt ?? 0);
}

export function relearnIsDue(): boolean {
  if (countByRating('liked') < MIN_LIKED_FOR_PROFILE && countByKind('own') === 0) return false;
  return ratingsSinceProfile() >= MIN_NEW_RATINGS;
}

/** استخلاص ملف أسلوب جديد من كل البيانات (يُنفَّذ مرة واحدة في كل لحظة) */
export async function relearnProfile(trigger: 'auto' | 'manual', opts?: { force?: boolean }): Promise<StyleProfile | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const spec = getSpec();
      const own = listOwnPostsSample(OWN_SAMPLE_MAX);
      const likedOther = listLikedNonOwn(20);
      const totalLiked = countByRating('liked'); // نصوصك (مسجّلة كمعجَب بها) + ما أعجبك من المولَّد والمرجعي
      const minLiked = opts?.force ? 1 : MIN_LIKED_FOR_PROFILE;
      if (!spec || totalLiked < minLiked) return null;
      const disliked = listDislikedWithReasons(20);
      const previous = latestProfile();
      setSetting('learning_started_at', String(Date.now()));

      const system = [systemText(LEARN_SYSTEM)];
      // نصوص المستخدم ثابتة بين التحديثات → تُخزَّن في الكاش لساعة
      if (own.posts.length) system.push(systemText(buildOwnCorpusBlock(own.posts, own.total), '1h'));

      const { data } = await structuredCall({
        kind: 'learn',
        schema: StyleProfileSchema,
        system,
        user: buildLearnUser({
          spec,
          ownCount: own.total,
          liked: likedOther,
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
        likedCount: own.total + likedOther.length,
        dislikedCount: disliked.length,
      });
      setSetting('last_learn_trigger', trigger);
      console.log(`[learn] profile v${profile.version} (${trigger}) from ${own.posts.length}/${own.total} own + ${likedOther.length} liked / ${disliked.length} disliked`);
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
  return Date.now() - Number(v) < 10 * 60 * 1000;
}
