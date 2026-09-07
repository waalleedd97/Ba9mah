import 'server-only';
import {
  bumpStyleStat,
  findSavedByPost,
  getArtDirection,
  getImage,
  getPost,
  getSaved,
  insertImage,
  listStyleStats,
  markImageSelected,
  rateImage,
  ruleTexts,
  setArtDirection,
  setSelectedImage,
  updateSaved,
} from '@/lib/db/repo';
import type { ImageRecord, ImageStylePreset, Post, SavedPost } from '@/lib/types';
import { AIError, structuredCall, systemText } from '@/lib/ai/gemini';
import { ArtDirectionSchema, type ArtDirection } from '@/lib/ai/schemas';
import { generateImage } from './gemini';
import { saveImageFile } from './storage';
import { IMAGE_STYLES, describeStylePreference, getStyle } from './styles';

const ART_SYSTEM = `أنت مدير إبداعي لصور منشورات LinkedIn العربية. مهمتك تحويل بوست إلى إخراج فني: عنوان عربي قصير قوي يُرسم داخل الصورة، وفكرة بصرية واحدة، ووصف بالإنجليزية لكل نمط من الأنماط المعطاة يُرسل لنموذج توليد صور.

قواعد:
- العنوان من 4 إلى 7 كلمات عربية، بلا علامات ترقيم زائدة، يلخص جوهر البوست لا موضوعه العام.
- في كل وصف اذكر العنوان العربي حرفياً بين علامتي « » واطلب رسمه بخط عربي واضح، ولا تطلب أي نص آخر إلا ما يسمح به النمط (تسميات من كلمة أو كلمتين).
- اجعل الفكرة البصرية بسيطة ومباشرة، بدون رموز مبهمة أو تفاصيل صغيرة.
- التزم بقواعد الستايل المفضلة وتجنب المرفوضة إن وُجدت.`;

const artCache = new Map<string, Promise<ArtDirection>>();

interface ArtSubject {
  key: string;
  topic: string;
  content: string;
  persist?: (json: string) => void;
  cached?: string | null;
}

async function artDirectionFor(subject: ArtSubject): Promise<ArtDirection> {
  if (subject.cached) {
    try {
      return ArtDirectionSchema.parse(JSON.parse(subject.cached));
    } catch {
      /* نعيد الحساب */
    }
  }
  const existing = artCache.get(subject.key);
  if (existing) return existing;

  const p = (async () => {
    const pref = describeStylePreference(listStyleStats());
    const styleRules = ruleTexts('image_style');
    const avoidRules = ruleTexts('image_avoid');
    const user = [
      `الموضوع: ${subject.topic}`,
      `نص البوست:\n${subject.content.slice(0, 1500)}`,
      `الأنماط المطلوبة:\n${IMAGE_STYLES.map((s) => `- ${s.key} (${s.label}):\n${s.prompt}`).join('\n\n')}`,
      styleRules.length ? `قواعد ستايل يفضلها المستخدم: ${styleRules.join(' | ')}` : '',
      avoidRules.length ? `يتجنب: ${avoidRules.join(' | ')}` : '',
      pref ?? '',
      'أخرج العنوان والفكرة ووصفاً لكل نمط من الأنماط الأربعة (style_key مطابق تماماً).',
    ]
      .filter(Boolean)
      .join('\n\n');

    const { data } = await structuredCall({
      kind: 'art_direction',
      schema: ArtDirectionSchema,
      system: [systemText(ART_SYSTEM)],
      user,
      effort: 'medium',
      maxTokens: 4000,
      mockHint: subject.topic,
    });
    subject.persist?.(JSON.stringify(data));
    return data;
  })();

  artCache.set(subject.key, p);
  p.catch(() => artCache.delete(subject.key)).finally(() => setTimeout(() => artCache.delete(subject.key), 10 * 60 * 1000));
  return p;
}

function composePrompt(style: ImageStylePreset, art: ArtDirection): string {
  const specific = art.prompts.find((p) => p.style_key === style.key)?.prompt ?? art.concept;
  const styleRules = ruleTexts('image_style');
  const avoidRules = ruleTexts('image_avoid');
  const lines = [
    'Create a 1080x1080 square image for an Arabic LinkedIn post.',
    '',
    `Render this exact Arabic headline, large and legible, in a clean modern Arabic font: «${art.headline}»`,
    'All text in the image must be Arabic, never English. Do not add any text that is not requested. Spell the Arabic exactly as given.',
    '',
    style.prompt,
    '',
    `Visual direction: ${specific}`,
  ];
  if (styleRules.length) lines.push('', 'User preferred styles (MUST follow):', ...styleRules.map((r) => `- ${r}`));
  if (avoidRules.length) lines.push('', 'Styles to AVOID:', ...avoidRules.map((r) => `- ${r}`));
  return lines.join('\n');
}

function requireStyle(key: string): ImageStylePreset {
  const s = getStyle(key);
  if (!s) throw new AIError('نمط صورة غير معروف', 'config');
  return s;
}

/** صورة بنمط معيّن لبوست مولّد */
export async function generatePostImage(post: Post, styleKey: string): Promise<ImageRecord> {
  const style = requireStyle(styleKey);
  const art = await artDirectionFor({
    key: `post:${post.id}`,
    topic: post.topic,
    content: post.content,
    cached: getArtDirection(post.id),
    persist: (json) => setArtDirection(post.id, json),
  });
  const prompt = composePrompt(style, art);
  const img = await generateImage({ prompt, mockSeed: `${post.id}:${style.key}` });
  const file = saveImageFile(img.buffer, img.mime);
  bumpStyleStat(style.key, 'shown');
  return insertImage({
    id: file.id,
    postId: post.id,
    source: 'post',
    styleKey: style.key,
    styleLabel: style.label,
    prompt,
    headline: art.headline,
    fileName: file.fileName,
    mime: img.mime,
    bytes: file.bytes,
  });
}

/** صورة بنمط معيّن لبوست محفوظ */
export async function generateSavedImage(saved: SavedPost, styleKey: string): Promise<ImageRecord> {
  const style = requireStyle(styleKey);
  const originPost = saved.postId ? getPost(saved.postId) : null;
  const art = await artDirectionFor({
    key: `saved:${saved.id}`,
    topic: saved.topic || saved.content.slice(0, 60),
    content: saved.content,
    cached: originPost ? getArtDirection(originPost.id) : null,
    persist: originPost ? (json) => setArtDirection(originPost.id, json) : undefined,
  });
  const prompt = composePrompt(style, art);
  const img = await generateImage({ prompt, mockSeed: `${saved.id}:${style.key}` });
  const file = saveImageFile(img.buffer, img.mime);
  bumpStyleStat(style.key, 'shown');
  return insertImage({
    id: file.id,
    savedPostId: saved.id,
    source: 'saved',
    styleKey: style.key,
    styleLabel: style.label,
    prompt,
    headline: art.headline,
    fileName: file.fileName,
    mime: img.mime,
    bytes: file.bytes,
  });
}

/** الاستوديو: توليد حر أو تعديل صورة مرفوعة */
export async function studioGenerate(prompt: string, input?: { base64: string; mime: string } | null): Promise<ImageRecord> {
  const styleRules = ruleTexts('image_style');
  const avoidRules = ruleTexts('image_avoid');
  const lines = [
    input ? `Edit this image according to these instructions:\n\n${prompt}` : `Create an image based on this description:\n\n${prompt}`,
    'If the image contains any text, it must be in Arabic.',
  ];
  if (styleRules.length) lines.push('', 'User preferred styles (MUST follow):', ...styleRules.map((r) => `- ${r}`));
  if (avoidRules.length) lines.push('', 'Styles to AVOID:', ...avoidRules.map((r) => `- ${r}`));
  const full = lines.join('\n');
  const img = await generateImage({ prompt: full, input: input ?? null, mockSeed: prompt });
  const file = saveImageFile(img.buffer, img.mime);
  return insertImage({
    id: file.id,
    source: 'studio',
    prompt,
    fileName: file.fileName,
    mime: img.mime,
    bytes: file.bytes,
  });
}

/** اختيار صورة من الشبكة لبوست أو لمحفوظ */
export function selectImage(imageId: string): ImageRecord | null {
  const img = getImage(imageId);
  if (!img) return null;
  markImageSelected(imageId);
  if (img.postId) {
    setSelectedImage(img.postId, imageId);
    const savedCopy = findSavedByPost(img.postId);
    if (savedCopy) updateSaved(savedCopy.id, { imageId });
  }
  if (img.savedPostId) updateSaved(img.savedPostId, { imageId });
  if (img.styleKey) bumpStyleStat(img.styleKey, 'selected');
  return getImage(imageId);
}

/** تسجيل تقييم صورة (المزامن فقط؛ التحليل بالرؤية يُجدول بعد الرد) */
export function applyImageRating(imageId: string, liked: boolean): ImageRecord | null {
  const img = getImage(imageId);
  if (!img) return null;
  const alreadyRated = img.rating;
  const updated = rateImage(imageId, liked ? 'liked' : 'disliked');
  if (img.styleKey && alreadyRated !== (liked ? 'liked' : 'disliked')) {
    bumpStyleStat(img.styleKey, liked ? 'liked' : 'disliked');
    if (alreadyRated) bumpStyleStat(img.styleKey, alreadyRated, -1);
  }
  return updated;
}

export { getSaved };
