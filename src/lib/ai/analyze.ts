import 'server-only';
import { addDislikeReason, addRule, capLearnedRules, getPost, latestProfile, ruleTexts } from '@/lib/db/repo';
import type { ImageRecord, Post } from '@/lib/types';
import { readImageFile } from '@/lib/images/storage';
import { getImageFile } from '@/lib/db/repo';
import { imageBlock, structuredCall, systemText } from './gemini';
import { DislikeAnalysisSchema, ImageDislikeSchema, ImageLikeSchema } from './schemas';
import { DISLIKE_SYSTEM, buildDislikeUser } from './prompts';

const MAX_LEARNED_AVOID = 15;
const MAX_LEARNED_IMAGE = 12;

/** بعد رفض بوست: تشخيص السبب وتحويله لقاعدة تجنب (يُستدعى بعد إرسال الرد) */
export async function analyzeDislikedPost(postId: string, userReason?: string): Promise<void> {
  const post = getPost(postId);
  if (!post) return;
  try {
    const profile = latestProfile();
    const { data } = await structuredCall({
      kind: 'analyze_dislike',
      schema: DislikeAnalysisSchema,
      system: [systemText(DISLIKE_SYSTEM)],
      user: buildDislikeUser(post, profile?.data.summary ?? null, ruleTexts('avoid'), userReason),
      effort: 'medium',
      maxTokens: 2000,
    });
    if (!userReason) addDislikeReason(post.id, data.reason, data.category);
    if ((userReason || data.confidence !== 'low') && data.avoid_rule.trim()) {
      addRule('avoid', data.avoid_rule, 'learned');
      capLearnedRules('avoid', MAX_LEARNED_AVOID);
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
