import 'server-only';
import {
  addRule,
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
  listRules,
  ruleTexts,
  setSetting,
  updateRule,
} from '@/lib/db/repo';
import type { StyleProfile } from '@/lib/types';
import { structuredCall, systemText } from './gemini';
import { LearnOutputSchema } from './schemas';
import {
  LEARN_SYSTEM,
  NEUTRAL_STRUCTURE,
  buildLearnUser,
  buildOwnCorpusBlock,
  contradictsCorpus,
  corpusStats,
  deterministicFormatting,
  deterministicLength,
  isOwnOpener,
  ownOpeners,
  renderProfileMarkdown,
  scrubOwnLines,
} from './prompts';

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
export async function relearnProfile(trigger: 'auto' | 'manual', opts?: { force?: boolean; fresh?: boolean }): Promise<StyleProfile | null> {
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
      // fresh: من الصفر بلا وراثة الملف السابق (عندما يكون السابق قد انحرف عن أسلوب المستخدم)
      const previous = opts?.fresh ? null : latestProfile();
      setSetting('learning_started_at', String(Date.now()));

      const system = [systemText(LEARN_SYSTEM)];
      // نصوص المستخدم ثابتة بين التحديثات → تُخزَّن في الكاش لساعة
      if (own.posts.length) system.push(systemText(buildOwnCorpusBlock(own.posts, own.total), '1h'));

      // القواعد الثابتة (الإعداد الأولي أو يدوية) مرجع؛ المتعلَّمة من تحليل الرفض تُراجَع وتُعاد صياغتها
      const avoidAll = listRules('avoid');
      const fixedAvoid = avoidAll.filter((r) => r.source !== 'learned');
      const learnedAvoid = avoidAll.filter((r) => r.source === 'learned');

      const { data: out } = await structuredCall({
        kind: 'learn',
        schema: LearnOutputSchema,
        system,
        user: buildLearnUser({
          spec,
          ownCount: own.total,
          liked: likedOther,
          disliked,
          goldenRules: ruleTexts('golden'),
          avoidRules: fixedAvoid.map((r) => r.text),
          learnedAvoidRules: learnedAvoid.map((r) => r.text),
          previous,
        }),
        effort: 'high',
        maxTokens: 8000,
      });
      const { avoid_rules_consolidated: consolidated, ...data } = out;

      // الملف لا يقتبس افتتاحيات المستخدم حرفياً: الكاتب ينسخها كما هي فتصير لازمة في كل جولة
      const openers = ownOpeners(own.posts);
      data.hooks = data.hooks.map((h) => scrubOwnLines(h, openers)).filter(Boolean);
      data.vocabulary = data.vocabulary.filter((v) => !isOwnOpener(v, openers));

      // حارس حتمي: الطول والتنسيق من إحصاءات نصوص المستخدم لا من رأي النموذج، وحذف كل منع يخالف نصوصه
      const stats = own.posts.length >= 5 ? corpusStats(own.posts) : null;
      let dropped: string[] = [];
      if (stats) {
        data.length = deterministicLength(stats);
        data.formatting = deterministicFormatting(stats);
        if (contradictsCorpus(data.structure, stats)) data.structure = NEUTRAL_STRUCTURE;
        dropped = data.do_not.filter((d) => contradictsCorpus(d, stats, data.vocabulary));
        data.do_not = data.do_not.filter((d) => !dropped.includes(d));
        if (dropped.length) console.log(`[learn] dropped ${dropped.length} do_not item(s) that contradict the user's own posts: ${dropped.join(' | ')}`);
      }

      const profile = insertProfile({
        markdown: renderProfileMarkdown(data),
        data,
        likedCount: own.total + likedOther.length,
        dislikedCount: disliked.length,
      });
      setSetting('last_learn_trigger', trigger);

      // دمج القواعد المتعلَّمة: بدل تراكم عشرات القواعد المتناقضة، قائمة قصيرة راجعها التعلم على ضوء نصوص المستخدم
      const clean = consolidated
        .map((r) => r.trim())
        .filter((r) => r.length >= 8 && r.length <= 180)
        .filter((r) => !(stats && contradictsCorpus(r, stats, data.vocabulary)))
        .slice(0, 8);
      if (learnedAvoid.length >= 4 && clean.length > 0) {
        for (const r of learnedAvoid) updateRule(r.id, { active: false });
        for (const r of clean) addRule('avoid', r, 'learned');
        console.log(`[learn] consolidated ${learnedAvoid.length} learned avoid rules into ${clean.length}`);
      }
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
