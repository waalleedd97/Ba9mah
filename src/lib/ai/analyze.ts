import 'server-only';
import { addDislikeReason, addRule, capLearnedRules, getPost, latestProfile, listOwnPostsSample, ruleTexts } from '@/lib/db/repo';
import type { ImageRecord, Post } from '@/lib/types';
import { readImageFile } from '@/lib/images/storage';
import { getImageFile } from '@/lib/db/repo';
import { keywords, overlap } from '@/lib/text';
import { imageBlock, structuredCall, systemText } from './gemini';
import { DislikeAnalysisSchema, ImageDislikeSchema, ImageLikeSchema } from './schemas';
import { DISLIKE_SYSTEM, buildDislikeUser, contradictsCorpus, corpusStats, layoutOf, type LayoutKind } from './prompts';

/** القواعد المتعلَّمة الفعّالة: قليلة كي لا تطغى على ملف الأسلوب ونصوص المستخدم في طلب التوليد */
const MAX_LEARNED_AVOID = 12;
const MAX_LEARNED_IMAGE = 12;
/** أقصى طول لقاعدة متعلَّمة؛ الأطول منها فقرة إنشائية لا تعليمات */
const MAX_RULE_CHARS = 180;

/** ثلاثة نصوص من كتابة المستخدم بأشكال بصرية مختلفة: مرجع التحليل */
function ownReference(): Post[] {
  const own = listOwnPostsSample(60).posts;
  const picked: Post[] = [];
  const seen = new Set<LayoutKind>();
  for (const p of own) {
    const kind = layoutOf(p.content);
    if (seen.has(kind)) continue;
    picked.push(p);
    seen.add(kind);
    if (picked.length >= 3) break;
  }
  for (const p of own) {
    if (picked.length >= 3) break;
    if (!picked.includes(p)) picked.push(p);
  }
  return picked;
}

/** قاعدة جديدة تكرر قاعدة موجودة (تشابه كلمات عالٍ) لا تُضاف */
function isDuplicateRule(text: string, existing: string[]): boolean {
  const kw = keywords(text);
  return existing.some((e) => overlap(kw, keywords(e)) >= 0.5);
}

/**
 * بعد رفض بوست: تشخيص السبب وتحويله لقواعد تجنب (يُستدعى بعد إرسال الرد).
 * التحليل يقيس على نصوص المستخدم نفسه كي لا "يصحح" أسلوبه إلى كتابة عامة، والقواعد قصيرة وغير مكررة.
 */
export async function analyzeDislikedPost(postId: string, userReasons: string[] = []): Promise<void> {
  const post = getPost(postId);
  if (!post) return;
  const reasons = userReasons.map((r) => r.trim()).filter(Boolean);
  try {
    const profile = latestProfile();
    const ownExamples = ownReference();
    const ownAll = listOwnPostsSample(60).posts;
    const stats = ownAll.length >= 5 ? corpusStats(ownAll) : null;
    const existing = ruleTexts('avoid');
    const { data } = await structuredCall({
      kind: 'analyze_dislike',
      schema: DislikeAnalysisSchema,
      system: [systemText(DISLIKE_SYSTEM)],
      user: buildDislikeUser(post, {
        ownExamples,
        layout: stats,
        profile: profile?.data ?? null,
        avoidRules: existing,
        userReasons: reasons,
      }),
      effort: 'medium',
      maxTokens: 2000,
    });
    if (reasons.length === 0) addDislikeReason(post.id, data.reason, data.category);
    if (reasons.length > 0 || data.confidence !== 'low') {
      let added = 0;
      for (const rule of data.avoid_rules.map((r) => r.trim()).filter(Boolean).slice(0, 3)) {
        if (rule.length > MAX_RULE_CHARS) {
          console.log(`[analyze] skipped an over-long rule (${rule.length} chars)`);
          continue;
        }
        if (isDuplicateRule(rule, existing)) {
          console.log(`[analyze] skipped a duplicate rule: ${rule.slice(0, 60)}`);
          continue;
        }
        // حارس حتمي: قاعدة تمنع ما يفعله المستخدم في نصوصه (أسطر قصيرة، مفرداته...) خاطئة مهما بدت مقنعة
        if (stats && contradictsCorpus(rule, stats, profile?.data.vocabulary ?? [])) {
          console.log(`[analyze] skipped a rule that contradicts the user's own posts: ${rule.slice(0, 60)}`);
          continue;
        }
        if (addRule('avoid', rule, 'learned')) added++;
      }
      if (added) capLearnedRules('avoid', MAX_LEARNED_AVOID);
    }
  } catch (err) {
    console.error('[analyze] dislike analysis failed:', err instanceof Error ? err.message : err);
  }
}

const IMAGE_SYSTEM = `أنت مدير إبداعي متخصص في صور منشورات LinkedIn العربية. سترى الصورة الفعلية التي قيّمها المستخدم مع سياق البوست. حلّل ما تراه بعينك (النص، الألوان، التكوين، الوضوح، الصلة بالموضوع) ولا تخمّن من الموضوع وحده. اكتب القواعد بالعربية، قصيرة وقابلة للتطبيق على صور أخرى.`;

function imageContext(image: ImageRecord, post: Post | null): string {
  const lines = [
    `النمط: ${image.styleLabel ?? image.styleKey ?? 'حر'}`,
    image.headline ? `العنوان المطلوب رسمه: ${image.headline}` : '',
    post ? `موضوع البوست: ${post.topic}\nنص البوست:\n${post.content.slice(0, 700)}` : '',
  ].filter(Boolean);
  const style = ruleTexts('image_style');
  const avoid = ruleTexts('image_avoid');
  if (style.length) lines.push(`قواعد ستايل حالية: ${style.join(' | ')}`);
  if (avoid.length) lines.push(`قواعد تجنب حالية: ${avoid.join(' | ')}`);
  return lines.join('\n\n');
}

/** بعد تقييم صورة: تعلم من الصورة نفسها (رؤية) */
export async function analyzeImageFeedback(imageId: string, liked: boolean): Promise<void> {
  const image = (await import('@/lib/db/repo')).getImage(imageId);
  if (!image) return;
  const ref = getImageFile(imageId);
  if (!ref) return;
  try {
    const bytes = readImageFile(ref.fileName);
    const post = image.postId ? getPost(image.postId) : null;
    const user = [
      imageBlock(bytes.toString('base64'), image.mime),
      { type: 'text' as const, text: `${imageContext(image, post)}\n\nتقييم المستخدم: ${liked ? 'أعجبته الصورة' : 'رفض الصورة'}` },
    ];

    if (liked) {
      const { data } = await structuredCall({
        kind: 'analyze_image_like',
        schema: ImageLikeSchema,
        system: [systemText(IMAGE_SYSTEM)],
        user,
        effort: 'medium',
        maxTokens: 1500,
      });
      if (data.reusable && data.style_rule.trim()) {
        addRule('image_style', data.style_rule, 'learned');
        capLearnedRules('image_style', MAX_LEARNED_IMAGE);
      }
    } else {
      const { data } = await structuredCall({
        kind: 'analyze_image_dislike',
        schema: ImageDislikeSchema,
        system: [systemText(IMAGE_SYSTEM)],
        user,
        effort: 'medium',
        maxTokens: 1500,
      });
      if (data.avoid_rule.trim()) {
        addRule('image_avoid', data.avoid_rule, 'learned');
        capLearnedRules('image_avoid', MAX_LEARNED_IMAGE);
      }
    }
  } catch (err) {
    console.error('[analyze] image analysis failed:', err instanceof Error ? err.message : err);
  }
}
