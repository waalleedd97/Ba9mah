import 'server-only';
import { getEnv } from '@/lib/env';
import { LABOR_LAW_TEXT } from './labor-law-text';
import { LaborLawSchema } from './schemas';
import { structuredCall, systemText, AIError } from './gemini';

/** مصطلحات تدل على معلومة قانونية تستحق التحقق من نظام العمل السعودي */
const LEGAL_TERMS =
  /نظام العمل|مكتب العمل|وزارة الموارد|مكافأة نهاية الخدمة|فترة التجربة|ساعات العمل|العمل الإضافي|الإجازة السنوية|الإجازة المرضية|إجازة الوضع|إجازة الأمومة|إجازة الحج|إجازة الزواج|إجازة الوفاة|إنهاء العقد|فسخ العقد|الاستقالة|بدل الإشعار|مهلة الإشعار|الجزاءات التأديبية|التوطين|السعودة|نطاقات|المادة\s*\d+|المادة ال|عقد العمل|الحد الأدنى للأجور|أجر الإجازة|الراحة الأسبوعية|عمل الأحداث|ذوي الإعاقة|الفصل التعسفي|التعويض عن الفصل/;

const HR_SPEC = /موارد بشرية|الموارد البشرية|\bhr\b|human resources/i;

export interface VerifiablePost {
  topic: string;
  content: string;
}

export interface VerificationResult {
  content: string;
  note: string | null;
  changed: boolean;
}

/** أي بوستات تحتاج تحقق؟ يرجّع الفهارس */
export function postsNeedingVerification(spec: string, posts: VerifiablePost[]): number[] {
  const mode = getEnv().LABOR_LAW_CHECK;
  if (mode === 'off') return [];
  if (mode === 'always' || HR_SPEC.test(spec)) return posts.map((_, i) => i);
  return posts.map((p, i) => (LEGAL_TERMS.test(p.content) || LEGAL_TERMS.test(p.topic) ? i : -1)).filter((i) => i >= 0);
}

const VERIFY_INSTRUCTIONS = `أنت مدقق قانوني صارم متخصص في نظام العمل السعودي ولائحته التنفيذية. مهمتك الوحيدة: التأكد أن كل رقم ونسبة ومدة ومعلومة قانونية في البوستات مطابقة للنص الرسمي المرفق.

أمثلة على أخطاء شائعة:
- "العمل الإضافي بأجر +25%" ← خطأ. الصحيح: أجر الساعة + 50% من الأجر الأساسي (المادة 107)
- "الإجازة السنوية 30 يوم من البداية" ← خطأ. الصحيح: 21 يوماً، وتصبح 30 يوماً بعد 5 سنوات متصلة (المادة 109)
- "فترة التجربة 3 أشهر" ← خطأ. الصحيح: لا تزيد على 180 يوماً (المادة 53)
- "مكافأة نهاية الخدمة راتب شهر عن كل سنة" ← خطأ. الصحيح: نصف شهر عن كل سنة من الخمس الأولى، وشهر عن كل سنة بعدها (المادة 84)

التعليمات:
1. افحص كل بوست كلمة كلمة: الأرقام، النسب، المدد، أرقام المواد، الحقوق والواجبات.
2. قارن كل معلومة قانونية بالنص الرسمي. عند التعارض صحح المعلومة لتطابق النص.
3. حافظ على الأسلوب واللهجة والطول والتنسيق؛ غيّر المعلومة الخاطئة فقط وأعد حساب أي مثال رقمي يعتمد عليها.
4. إذا كان البوست لا يتعلق بنظام العمل أو معلوماته صحيحة فأعده كما هو مع changed=false.
5. لا تضف معلومات جديدة ولا تغير الموضوع.
6. أعد كل البوستات المطلوبة بنفس أرقامها (index).`;

export async function verifyLaborLaw(posts: VerifiablePost[]): Promise<Map<number, VerificationResult>> {
  const results = new Map<number, VerificationResult>();
  if (posts.length === 0) return results;

  // النص القانوني الطويل والتعليمات ثابتان → نقطة كاش واحدة لمدة ساعة
  const system = [
    systemText(`=== النص الرسمي لنظام العمل السعودي ولائحته التنفيذية ===\n${LABOR_LAW_TEXT}\n=== نهاية النص ===`),
    systemText(VERIFY_INSTRUCTIONS, '1h'),
  ];
  const user =
    'البوستات المطلوب مراجعتها:\n\n' +
    posts.map((p, i) => `--- بوست index=${i} ---\nالموضوع: ${p.topic}\nالنص:\n${p.content}`).join('\n\n');

  const { data } = await structuredCall({ kind: 'verify', schema: LaborLawSchema, system, user, effort: 'high', maxTokens: 16000 });

  for (const item of data.posts) {
    const original = posts[item.index];
    if (!original) continue;
    const changed = item.changed && item.content.trim() !== original.content.trim();
    const note = changed && item.corrections.length
      ? item.corrections.map((c) => `${c.claim} ← ${c.correction} (${c.article})`).join(' | ')
      : changed
        ? 'صُحح ليطابق نظام العمل'
        : null;
    results.set(item.index, { content: changed ? item.content : original.content, note, changed });
  }
  // أي بوست لم يرجع نعتبره كما هو ومتحققاً منه
  posts.forEach((p, i) => {
    if (!results.has(i)) results.set(i, { content: p.content, note: null, changed: false });
  });
  return results;
}

/** يشغّل التحقق عند الحاجة ولا يُسقط التوليد إذا فشل */
export async function verifyIfNeeded(spec: string, posts: VerifiablePost[]): Promise<Map<number, VerificationResult>> {
  const idx = postsNeedingVerification(spec, posts);
  if (idx.length === 0) return new Map();
  try {
    const subset = idx.map((i) => posts[i]);
    const res = await verifyLaborLaw(subset);
    const mapped = new Map<number, VerificationResult>();
    idx.forEach((originalIndex, k) => {
      const r = res.get(k);
      if (r) mapped.set(originalIndex, r);
    });
    return mapped;
  } catch (err) {
    console.error('[labor-law] verification failed, keeping originals:', err instanceof AIError ? err.message : err);
    return new Map();
  }
}
