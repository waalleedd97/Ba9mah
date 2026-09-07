import type { Post, StyleProfile, StyleProfileData } from '@/lib/types';
import type { DislikedWithReason } from '@/lib/db/repo';
import { keywords, overlap, normalizeText } from '@/lib/text';
import { FORMATS } from './schemas';
import { systemText, type SystemBlock } from './gemini';

/** عرض ملف الأسلوب كـ Markdown ثابت الترتيب (كي يُخزَّن في الكاش) */
export function renderProfileMarkdown(d: StyleProfileData): string {
  const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join('\n') : '- (لا يوجد بعد)');
  return `## ملخص
${d.summary}

## النبرة والصوت
${d.voice}

## البنية
${d.structure}

## الطول
${d.length}

## الافتتاحيات الناجحة
${list(d.hooks)}

## التنسيق
${d.formatting}

## مفردات وتعابير مميزة
${list(d.vocabulary)}

## حركات مميزة
${list(d.signature_moves)}

## تجنب
${list(d.do_not)}

## مواضيع تنجح
${list(d.topics_that_work)}

(مستوى الثقة: ${d.confidence})`;
}

/**
 * اختيار أمثلة متنوعة من البوستات المعجَب بها:
 * - حتى 2 مرتبطة بالموضوع المطلوب (تشابه كلمات)
 * - الأحدث، مع تخطي المواضيع المكررة
 * - عند وجود نسخة معدّلة يدوياً نستخدمها لأنها الأقرب لذوق المستخدم
 */
export function selectExamples(liked: Post[], topic: string | undefined, n = 6): Post[] {
  if (liked.length <= n) return liked;
  const picked: Post[] = [];
  const usedTopics = new Set<string>();
  const add = (p: Post) => {
    if (picked.some((x) => x.id === p.id)) return;
    picked.push(p);
    usedTopics.add(normalizeText(p.topic));
  };

  // ما كتبه المستخدم بنفسه هو المرجع الأول للصوت: الأقرب للموضوع ثم الأحدث
  const own = liked.filter((x) => x.kind === 'own');
  if (topic && own.length) {
    const kw = keywords(topic);
    own
      .map((p) => ({ p, s: overlap(kw, keywords(`${p.topic} ${p.content}`)) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 2)
      .forEach(({ p }) => add(p));
  }
  for (const p of own) {
    if (picked.filter((x) => x.kind === 'own').length >= 3) break;
    add(p);
  }

  if (topic) {
    const kw = keywords(topic);
    const scored = liked
      .map((p) => ({ p, s: overlap(kw, keywords(`${p.topic} ${p.content}`)) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 2);
    for (const { p } of scored) add(p);
  }

  for (const p of liked) {
    if (picked.length >= n) break;
    if (usedTopics.has(normalizeText(p.topic))) continue;
    add(p);
  }
  for (const p of liked) {
    if (picked.length >= n) break;
    add(p);
  }
  return picked.slice(0, n);
}

/** عدد البوستات الاستكشافية من أصل 4 — يقل مع تراكم الإعجابات ويبقى واحد كل ثالث جولة */
export function explorationCount(likedCount: number, roundsSoFar: number): number {
  if (likedCount < 8) return 2;
  if (likedCount < 20) return 1;
  return (roundsSoFar + 1) % 3 === 0 ? 1 : 0;
}

const STATIC_GENERATION_RULES = `أنت تكتب بوستات LinkedIn نيابة عن شخص حقيقي له صوته الخاص. الهدف أن يقرأها زملاؤه فيقولون "هذا كلامه"، لا "هذا كلام ذكاء اصطناعي".

كيف يكتب الإنسان الحقيقي على LinkedIn:
- يبدأ من موقف أو ملاحظة أو رأي محدد عاشه، لا من تعريفات ولا من "في عالم اليوم".
- أول سطر يقف وحده ويُشعر القارئ أن ما بعده يستحق الضغط على "عرض المزيد"، بلا تهويل ولا وعود.
- فكرة واحدة لكل بوست. التفاصيل الملموسة (موقف، رقم من التجربة، جملة قالها أحدهم) أقوى من العموميات.
- إيقاع طبيعي: جمل قصيرة وطويلة تتناوب، سطر واحد أحياناً وفقرة أحياناً. لا قالب ثابت.
- موقف واضح يحتمل الخلاف، ولا يخاف الاعتراف بخطأ أو شك.
- خاتمة طبيعية: استنتاج، أو جملة تبقى في الذهن، أو سؤال حقيقي يهم الكاتب فعلاً. ليس كل بوست ينتهي بسؤال.
- اللهجة السعودية البيضاء افتراضاً ما لم تنص قواعد المستخدم على غيرها. المصطلحات الإنجليزية الشائعة في المجال تُكتب كما تُقال.

ممنوعات لأنها تفضح الكتابة الآلية:
- العبارات الجاهزة: "في عالم اليوم"، "لا يخفى على أحد"، "دعونا"، "من الجدير بالذكر"، "في الختام"، "رحلة"، "شغف"، "الغوص في"، "بلا شك"، "لنكن صادقين"، "إليك".
- افتتاحيات القوالب: "هل تعلم أن"، "في عام كذا تعلمت"، "3 دروس غيّرت حياتي"، إلا إن كانت من أسلوب المستخدم فعلاً.
- الحماس المصطنع، الإيموجي، الهاشتاقات، التعداد الرقمي، والنصائح العامة التي تصلح لأي أحد، إلا إن طلبها المستخدم صراحة.
- اختلاق أرقام أو دراسات أو أسماء جهات أو اقتباسات. إذا احتجت رقماً فمن التجربة بصيغة تقديرية، أو معلومة عامة معروفة.
- التكرار: لا تعيد الفكرة بصياغات مختلفة ولا تشرح ما فهمه القارئ.
- الكمال المصقول: الكتابة الحقيقية فيها نفس، واعتراض قصير بين قوسين، وجملة ناقصة أحياناً.

الأشكال المتاحة (نوّع بينها داخل الجولة بما يناسب ملف المستخدم): ${FORMATS.join(' · ')}.

منهج الجولة:
- البوست الملتزم: يطبق ملف الأسلوب وقواعد المستخدم ويقلّد إيقاع أمثلته، خصوصاً ما كتبه بنفسه.
- البوست الاستكشافي: يحافظ على الصوت لكنه يجرب شكلاً أو بنية غير مذكورة في الملف، ليتعلم النظام حدود ذوق المستخدم.
- قبل الإخراج اقرأ كل بوست كأنك المستخدم نفسه: لو شعرت أنه كتبه مستشار تسويق أو أداة، أعد كتابته. راجع القواعد الذهبية وقائمة التجنب وأسباب الرفض السابقة.
- النص هو ما سيُنشر حرفياً: بلا عناوين ولا شروح ولا علامات اقتباس حول البوست.`;

export interface GenerationContext {
  spec: string;
  profile: StyleProfile | null;
  goldenRules: string[];
  avoidRules: string[];
}

export function buildGenerationSystem(ctx: GenerationContext): SystemBlock[] {
  const parts: string[] = [];
  parts.push(`التخصص: ${ctx.spec}`);
  if (ctx.profile) {
    parts.push(`=== ملف أسلوب المستخدم (الإصدار ${ctx.profile.version}) ===\n${ctx.profile.markdown}`);
  } else {
    parts.push('=== ملف الأسلوب ===\nلم يُستخلص بعد. اعتمد على القواعد الذهبية والأمثلة.');
  }
  if (ctx.goldenRules.length) {
    parts.push(`=== القواعد الذهبية (أعلى أولوية، التزم بها دائماً) ===\n${ctx.goldenRules.map((r) => `- ${r}`).join('\n')}`);
  }
  if (ctx.avoidRules.length) {
    parts.push(`=== تجنب تماماً ===\n${ctx.avoidRules.map((r) => `- ${r}`).join('\n')}`);
  }
  return [systemText(STATIC_GENERATION_RULES), systemText(parts.join('\n\n'), '5m')];
}

export interface GenerationUserInput {
  topic: string | null;
  examples: Post[];
  disliked: DislikedWithReason[];
  recentTopics: string[];
  exploratory: number;
  roundNumber: number;
}

export function buildGenerationUser(input: GenerationUserInput): string {
  const sections: string[] = [];

  if (input.examples.length) {
    sections.push(
      `=== أمثلة أعجبت المستخدم (قلّد أسلوبها لا موضوعها) ===\n` +
        input.examples
          .map((p, i) => {
            const edited = p.originalContent && p.originalContent !== p.content ? ' (عدّلها المستخدم بيده قبل الإعجاب — هذه النسخة النهائية)' : '';
            const own = p.kind === 'own' ? ' (كتبه المستخدم بنفسه — قلّد صوته وإيقاعه)' : '';
            return `--- مثال ${i + 1} | الموضوع: ${p.topic}${own}${edited} ---\n${p.content}`;
          })
          .join('\n\n'),
    );
  }

  if (input.disliked.length) {
    sections.push(
      `=== بوستات رفضها المستخدم (لا تكتب بهذا الشكل) ===\n` +
        input.disliked
          .map((d, i) => {
            const why = d.reasons.length ? `\nسبب الرفض: ${d.reasons.join(' | ')}` : '';
            return `--- مرفوض ${i + 1} | الموضوع: ${d.post.topic} ---\n${d.post.content}${why}`;
          })
          .join('\n\n'),
    );
  }

  if (input.recentTopics.length) {
    sections.push(`=== مواضيع كُتبت مؤخراً (لا تكررها ولا تقترب منها) ===\n${input.recentTopics.map((t) => `- ${t}`).join('\n')}`);
  }

  const committed = 4 - input.exploratory;
  const task = input.topic
    ? `اكتب 4 بوستات LinkedIn عن الموضوع التالي: "${input.topic}"\nكل بوست يتناول زاوية مختلفة تماماً من نفس الموضوع.`
    : `اكتب 4 بوستات LinkedIn جديدة، كل واحد عن موضوع مختلف يهم جمهور التخصص، بمواضيع جديدة ومفيدة وغير مستهلكة.`;

  sections.push(
    `=== المطلوب (الجولة ${input.roundNumber}) ===\n${task}\n` +
      `التوزيع: ${committed} بوست ملتزم بملف الأسلوب، و${input.exploratory} بوست استكشافي (علّمه exploratory=true).\n` +
      `نوّع الأشكال: لا يتكرر الشكل بين البوستات الأربعة، ولا يتكرر نوع الخاتمة.`,
  );

  return sections.join('\n\n');
}

// ---------------------------------------------------------------- التعلم

export const LEARN_SYSTEM = `أنت محلل أسلوب كتابة خبير. مهمتك استخلاص "ملف أسلوب" دقيق وعملي لكاتب محتوى LinkedIn سعودي من البوستات التي أعجبته والتي رفضها.

مبادئ التحليل:
- ركّز على ما يميّز المعجَب به عن المرفوض، لا على الصفات العامة لأي بوست جيد.
- لا تعمم من مثال واحد. كل صفة تذكرها يجب أن تتكرر في عدة أمثلة معجَب بها.
- النصوص التي كتبها المستخدم بنفسه هي المرجع الأول لصوته: مفرداته، إيقاعه، طريقة بدايته وخاتمته. استخلص منها أكثر من أي مصدر آخر.
- إذا عدّل المستخدم بوستاً بيده قبل الإعجاب، فالفرق بين النسخة الأصلية والمعدّلة هو أقوى إشارة لذوقه بعد نصوصه.
- صف الصوت كإنسان لا كقالب: ما الذي يجعله يبدو حقيقياً؟ وما الذي لو أضفته لبدا آلياً؟
- أسباب الرفض المسجلة إشارات مباشرة، حوّلها إلى قواعد تجنب واضحة.
- اكتب الملف بصيغة تعليمات يستطيع كاتب آخر تطبيقها فوراً، بدون إنشاء أو مديح.
- حدد مستوى الثقة بحسب حجم البيانات: نصوص المستخدم نفسه تزن أكثر. 15+ نصاً من كتابته = high، 5 إلى 14 أو 20+ معجَب = medium، أقل = low.
- إذا وُجد ملف سابق فحدّثه بدل البدء من الصفر: احتفظ بما تأكد، وعدّل ما تناقض مع البيانات الجديدة.`;

export function buildOwnCorpusBlock(own: Post[], total: number): string {
  const head = own.length < total ? `عيّنة ممثلة: ${own.length} نصاً من أصل ${total} كتبها المستخدم بنفسه (الأحدث أولاً ثم توزيع من الأقدم)` : `${own.length} نصاً كتبها المستخدم بنفسه`;
  return `=== نصوص المستخدم — المرجع الأول لصوته ===\n${head}\n\n` + own.map((p, i) => `--- نص ${i + 1} ---\n${p.content}`).join('\n\n');
}

export interface LearnInput {
  spec: string;
  ownCount: number;
  /** المعجَب به من غير نصوص المستخدم (مولّد أو مرجع) */
  liked: Post[];
  disliked: DislikedWithReason[];
  goldenRules: string[];
  avoidRules: string[];
  previous: StyleProfile | null;
}

export function buildLearnUser(input: LearnInput): string {
  const sections: string[] = [`التخصص: ${input.spec}`];
  if (input.ownCount > 0) sections.push(`لدى المستخدم ${input.ownCount} نصاً من كتابته (مرفقة في تعليمات النظام). استخلص الصوت منها أولاً، ثم عدّله بما يلي.`);
  if (input.previous) sections.push(`=== الملف السابق (الإصدار ${input.previous.version}) ===\n${input.previous.markdown}`);
  if (input.goldenRules.length) sections.push(`=== قواعد اختارها المستخدم ===\n${input.goldenRules.map((r) => `- ${r}`).join('\n')}`);
  if (input.avoidRules.length) sections.push(`=== قواعد تجنب حالية ===\n${input.avoidRules.map((r) => `- ${r}`).join('\n')}`);
  if (input.liked.length) {
    sections.push(
      `=== بوستات أخرى أعجبته (${input.liked.length}) ===\n` +
        input.liked
          .map((p, i) => {
            const label = p.kind === 'seed' ? 'مثال أولي عام' : p.kind === 'reference' ? 'بوست لغيره أعجبه أسلوبه' : 'مولّد وأعجبه';
            const base = `--- معجَب ${i + 1} | ${p.topic} | ${label} ---\n${p.content}`;
            const diff = p.originalContent && p.originalContent !== p.content ? `\n[النسخة الأصلية قبل تعديل المستخدم]\n${p.originalContent}` : '';
            return base + diff;
          })
          .join('\n\n'),
    );
  }
  if (input.disliked.length) {
    sections.push(
      `=== بوستات رفضها (${input.disliked.length}) ===\n` +
        input.disliked
          .map((d, i) => `--- مرفوض ${i + 1} | ${d.post.topic} ---\n${d.post.content}${d.reasons.length ? `\nأسباب الرفض: ${d.reasons.join(' | ')}` : ''}`)
          .join('\n\n'),
    );
  }
  sections.push('استخلص ملف الأسلوب الآن.');
  return sections.join('\n\n');
}

// ---------------------------------------------------------------- التحليل والتعديل

export const DISLIKE_SYSTEM = `أنت محرر محتوى LinkedIn خبير بالسوق السعودي. يرفض المستخدم بوستاً مولّداً، ومهمتك تشخيص السبب الأرجح بدقة وتحويله إلى قاعدة تجنب عامة تفيد كل البوستات القادمة. كن محدداً: "نبرة وعظية في الخاتمة" أفضل من "أسلوب سيئ".`;

export function buildDislikeUser(post: Post, profileSummary: string | null, avoidRules: string[], userReason?: string): string {
  const ctx = [
    profileSummary ? `ملخص أسلوب المستخدم: ${profileSummary}` : '',
    avoidRules.length ? `قواعد تجنب حالية (لا تكررها حرفياً): ${avoidRules.join(' | ')}` : '',
    userReason ? `سبب الرفض كما قاله المستخدم بنفسه: "${userReason}" — اجعل القاعدة تترجم هذا السبب تحديداً إلى تعليمات كتابة` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return `${ctx ? ctx + '\n\n' : ''}البوست المرفوض | الموضوع: ${post.topic}\n${post.content}`;
}

export function buildEditSystem(spec: string, profile: StyleProfile | null, goldenRules: string[]): SystemBlock[] {
  const parts = [
    `أنت محرر محتوى LinkedIn للسوق السعودي. التخصص: ${spec}.\nعدّل البوست حسب تعليمات المستخدم فقط، وحافظ على صوته الإنساني ونبرته ولهجته. لا عبارات جاهزة ولا صقل زائد ولا مقدمات ولا شروحات داخل النص.`,
  ];
  if (profile) parts.push(`=== ملف أسلوب المستخدم ===\n${profile.markdown}`);
  if (goldenRules.length) parts.push(`=== القواعد الذهبية ===\n${goldenRules.map((r) => `- ${r}`).join('\n')}`);
  return [systemText(parts.join('\n\n'), '5m')];
}
