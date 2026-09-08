import type { NewsBrief, Post, StyleProfile, StyleProfileData } from '@/lib/types';
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
  // أمثلة المستخدم متنوعة الشكل البصري (قصير، فقرة، قائمة، أسطر) كي لا يقلّد النموذج قالباً واحداً
  const ownPicked = () => picked.filter((x) => x.kind === 'own');
  const seenLayouts = new Set(ownPicked().map((p) => layoutOf(p.content)));
  for (const p of own) {
    if (ownPicked().length >= 3) break;
    const layout = layoutOf(p.content);
    if (seenLayouts.has(layout)) continue;
    add(p);
    seenLayouts.add(layout);
  }
  for (const p of own) {
    if (ownPicked().length >= 3) break;
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
- الطول يتبع عادة المستخدم لا الحد الأقصى: إذا كانت أغلب نصوصه ثلاثة أسطر فلا تكتب اثني عشر. نصوصه وملف أسلوبه هما المقياس.
- الشكل البصري يتبع نصوص المستخدم ويتنوع مثلها: افتتاحية قصيرة مستقلة، ثم الشرح كما يناسب الفكرة: فقرة متصلة من جملتين أو ثلاث، أو أسطر قصيرة، أو قائمة إن كان يستخدمها. القالب الواحد المكرر (سطر قصير، فراغ، سطر قصير) في كل بوست يفضح الكتابة الآلية بقدر الكتلة الواحدة الطويلة.
- لا تنسخ افتتاحيات الأمثلة أو تعابيرها المميزة حرفياً. اللازمة المميزة (صرخة اندهاش، تعبير خاص) تظهر عند المستخدم مرة كل عدة بوستات؛ فلا تظهر في أكثر من بوست واحد في الجولة، وغالباً لا تظهر أصلاً.
- الرسم الإملائي جزء من الصوت: اكتب الهمزات والتنوين وعلامات الترقيم كما يكتبها المستخدم في نصوصه، ولا تصحح له.

ممنوعات لأنها تفضح الكتابة الآلية:
- العبارات الجاهزة: "في عالم اليوم"، "لا يخفى على أحد"، "دعونا"، "من الجدير بالذكر"، "في الختام"، "رحلة"، "شغف"، "الغوص في"، "بلا شك"، "لنكن صادقين"، "إليك".
- افتتاحيات القوالب: "هل تعلم أن"، "في عام كذا تعلمت"، "3 دروس غيّرت حياتي"، إلا إن كانت من أسلوب المستخدم فعلاً.
- الحماس المصطنع والنصائح العامة التي تصلح لأي أحد.
- الإيموجي والهاشتاقات والتعداد الرقمي والنقاط: لا تضفها من عندك. استخدمها فقط بالقدر والطريقة اللذين يظهران في نصوص المستخدم وملف أسلوبه، وبنفس مواضعها عنده.
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
  /** إحصاءات نصوص المستخدم نفسه (إن كانت كافية) لفرض شكله البصري وطوله */
  layout?: CorpusStats | null;
  /** هدف شكل بصري لكل بوست (عدد الأسطر وأطوالها) مأخوذ من نصوص المستخدم، انظر shapeTargets */
  shapes?: string[];
  /** خبر بحث عنه النظام ويريد المستخدم الكتابة عنه */
  news?: NewsBrief | null;
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
          .join('\n\n') +
        `\n\nأسطر افتتاحية ممنوع نسخها أو تحويرها في أي بوست (هي أسطر المستخدم نفسه، والنسخ يفضح التقليد): ` +
        input.examples.map((p) => `"${p.content.split('\n').find((l) => l.trim())?.trim().slice(0, 60) ?? ''}"`).join(' | '),
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

  if (input.news) {
    const sources = input.news.sources.length ? `\nالمصادر: ${input.news.sources.map((s) => `${s.title} (${s.url})`).join(' | ')}` : '';
    sections.push(
      `=== خبر يريد المستخدم الكتابة عنه ===\nالعنوان: ${input.news.headline}\n${input.news.brief}${sources}\n` +
        `اكتب البوستات الأربعة عن هذا الخبر تحديداً، كل بوست بزاوية مختلفة: تعليق سريع كمن قرأه للتو، ماذا يعني عملياً لجمهور التخصص في السعودية، رأي أو تحفّظ يخالف الحماس السائد، ودرس أو خطوة عملية مستفادة. ` +
        `اعتمد على الحقائق الواردة أعلاه فقط ولا تختلق أرقاماً أو تفاصيل أو تصريحات. لا تنسخ الصياغة الصحفية؛ اكتب كما يكتب المستخدم عن خبر قرأه. ` +
        `اذكر رابط المصدر الرئيسي في بوست واحد على الأكثر إن ناسب أسلوبه.`,
    );
  }

  const committed = 4 - input.exploratory;
  const task = input.news
    ? `اكتب 4 بوستات LinkedIn عن الخبر أعلاه.\nكل بوست يتناول زاوية مختلفة تماماً منه.`
    : input.topic
      ? `اكتب 4 بوستات LinkedIn عن الموضوع التالي: "${input.topic}"\nكل بوست يتناول زاوية مختلفة تماماً من نفس الموضوع.`
      : `اكتب 4 بوستات LinkedIn جديدة، كل واحد عن موضوع مختلف يهم جمهور التخصص، بمواضيع جديدة ومفيدة وغير مستهلكة.`;

  const layout = input.layout && input.layout.count >= 5 ? `\nالشكل البصري كما في نصوص المستخدم: ${describeLayout(input.layout)}.` : '';
  const shapes = input.shapes?.length
    ? `\nالشكل المستهدف لكل بوست، مأخوذ من نصوص المستخدم نفسها (عدد الأسطر غير الفارغة وطول كل سطر بالأحرف تقريباً ±30%؛ سطر فارغ بين الأسطر):\n${input.shapes.join('\n')}`
    : '';
  sections.push(
    `=== المطلوب (الجولة ${input.roundNumber}) ===\n${task}\n` +
      `التوزيع: ${committed} بوست ملتزم بملف الأسلوب، و${input.exploratory} بوست استكشافي (علّمه exploratory=true).\n` +
      `نوّع الأشكال: لا يتكرر الشكل بين البوستات الأربعة، ولا نوع الخاتمة، ولا الشكل البصري (عدد الأسطر وطولها).${layout}${shapes}`,
  );

  return sections.join('\n\n');
}

// ---------------------------------------------------------------- التعلم

export const LEARN_SYSTEM = `أنت محلل أسلوب كتابة خبير. مهمتك استخلاص "ملف أسلوب" دقيق وعملي لكاتب محتوى LinkedIn سعودي من البوستات التي أعجبته والتي رفضها.

مبادئ التحليل:
- ركّز على ما يميّز المعجَب به عن المرفوض، لا على الصفات العامة لأي بوست جيد.
- لا تعمم من مثال واحد. كل صفة تذكرها يجب أن تتكرر في عدة أمثلة معجَب بها.
- النصوص التي كتبها المستخدم بنفسه هي المرجع الأول لصوته: مفرداته، إيقاعه، طريقة بدايته وخاتمته. استخلص منها أكثر من أي مصدر آخر.
- حدد الصوت الغالب أولاً. النصوص القليلة التي تخالفه بوضوح (اقتباس منقول عن شخص آخر، تحية صباحية، فصحى رسمية بين نصوص عامية، قائمة مبتورة من سطرين) ضجيج: لا تستخلص منها الصوت ولا تذكرها كسمة.
- الطول والتنسيق أرقام لا انطباعات: اعتمد الإحصاءات المحسوبة المرفقة مع النصوص. قل النسبة ("ربع النصوص فيها إيموجي"، "الغالب ثلاثة أسطر") ولا تستخدم كلمات مثل "مكثف" أو "دائماً" إلا إذا أيدتها الأرقام.
- الرسم الإملائي جزء من الصوت: هل يكتب الهمزة في أول الكلمة (أ/إ) أم ألفاً مجردة (اذا، اكثر)؟ هل يستخدم التنوين؟ ما علامات الترقيم التي يفضلها (.. أو ، أو ! أو لا شيء)؟ اذكر ذلك صراحة في التنسيق حتى يقلده الكاتب ولا يصححه.
- الافتتاحيات: صف النوع لا السطر الحرفي (مثال: "خبر تقني بصيغة اندهاش"، "حكم قاطع على ممارسة شائعة"). لا تقتبس أسطراً حرفية من نصوصه في الملف إطلاقاً؛ الكاتب الذي يقرأ الملف ينسخها كما هي فتصبح لازمة مكررة. ولا تحوّل صرخة اندهاش أو تعبيراً يكرره أحياناً إلى قاعدة؛ اذكره كنوع نادر يظهر مرة كل عدة بوستات.
- الشكل البصري: صف التنوع لا القالب وبالنسب المرفقة: كم بالمئة فقرات متصلة من جملتين أو ثلاث، وكم أسطر قصيرة، وكم قوائم. لا تكتب أن الكاتب "يفضل" الفقرات أو "يفضل" الأسطر المفردة، ولا قاعدة تمنع أحدهما؛ الشكل عنده يتبع الفكرة.
- المفردات والتعابير: فقط ما تكرر مرتين فأكثر أو ما يميزه بوضوح، وبالصيغة التي كتبها هو. لا تذكر التعبير الواحد بصيغتين.
- إذا عدّل المستخدم بوستاً بيده قبل الإعجاب، فالفرق بين النسخة الأصلية والمعدّلة هو أقوى إشارة لذوقه بعد نصوصه.
- صف الصوت كإنسان لا كقالب: ما الذي يجعله يبدو حقيقياً؟ وما الذي لو أضفته لبدا آلياً؟
- أسباب الرفض المسجلة إشارات مباشرة، حوّلها إلى قواعد تجنب واضحة.
- اكتب الملف بصيغة تعليمات يستطيع كاتب آخر تطبيقها فوراً، بدون إنشاء أو مديح.
- حدد مستوى الثقة بحسب حجم البيانات: نصوص المستخدم نفسه تزن أكثر. 15+ نصاً من كتابته = high، 5 إلى 14 أو 20+ معجَب = medium، أقل = low.
- إذا وُجد ملف سابق فحدّثه بدل البدء من الصفر: احتفظ بما تأكد، وعدّل ما تناقض مع البيانات الجديدة.`;

/** إحصاءات حتمية من نصوص المستخدم تُرفق مع التعلم كي لا يبني النموذج الطول والتنسيق على الانطباع */
export interface CorpusStats {
  count: number;
  medianChars: number;
  medianLines: number;
  /** نصوص من 3 أسطر غير فارغة أو أقل */
  shortShare: number;
  /** نصوص من 10 أسطر غير فارغة فأكثر */
  longShare: number;
  emojiShare: number;
  bulletShare: number;
  linkShare: number;
  questionEndShare: number;
  /** نصوص فيها سطر طويل (90 حرفاً فأكثر: جملتان أو أكثر متصلتان في فقرة) */
  longLineShare: number;
  /** الوسيط لطول أطول سطر في النص */
  medianMaxLineChars: number;
  /** نصوص من ثلاثة أسطر فأكثر كلها أسطر قصيرة (أقل من 70 حرفاً): القالب المتقطع */
  allShortShare: number;
  /** 90% من الأسطر غير الفارغة أقصر من هذا الطول: سقف عملي لطول السطر */
  p90LineChars: number;
  /** نصوص متعددة الأسطر تفصل بين أسطرها بسطر فارغ */
  blankSepShare: number;
  /** كلمات شائعة كُتبت بهمزة في أولها (أن، إذا، أكثر...) مقابل كتابتها بألف مجردة (ان، اذا، اكثر...) */
  hamzaWords: number;
  bareAlefWords: number;
}

const EMOJI_RE = /\p{Extended_Pictographic}/u;
const BULLET_LINE_RE = /^[ \t]*(?:[-•*▪◦✅✔]|\d+[.)-]|[١-٩][.)-])[ \t]*\S/mu;
const LINK_RE = /https?:\/\/\S+|(?:^|\s)@[A-Za-z0-9_]{2,}/u;
const HAMZA_PAIRS: Array<[string, string]> = [
  ['أن', 'ان'], ['إذا', 'اذا'], ['أو', 'او'], ['أكثر', 'اكثر'], ['أفضل', 'افضل'], ['أنا', 'انا'], ['إلى', 'الى'], ['أي', 'اي'],
  ['أول', 'اول'], ['أكبر', 'اكبر'], ['أحد', 'احد'], ['إلا', 'الا'], ['أهم', 'اهم'], ['أسهل', 'اسهل'], ['أخذ', 'اخذ'], ['أصلا', 'اصلا'],
  ['أنت', 'انت'], ['أخير', 'اخير'], ['أقل', 'اقل'], ['أغلب', 'اغلب'], ['إن', 'ان'], ['أعرف', 'اعرف'], ['أقدر', 'اقدر'], ['أبي', 'ابي'],
];
const HAMZA_FORMS = new Set(HAMZA_PAIRS.map(([h]) => h));
const BARE_FORMS = new Set(HAMZA_PAIRS.map(([, b]) => b));

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

const nonEmptyLines = (t: string) => t.split('\n').filter((l) => l.trim()).length;

export function corpusStats(posts: Post[]): CorpusStats {
  const texts = posts.map((p) => p.content);
  const n = texts.length;
  const share = (pred: (t: string) => boolean) => (n ? texts.filter(pred).length / n : 0);
  let hamzaWords = 0;
  let bareAlefWords = 0;
  for (const t of texts) {
    for (const raw of t.split(/\s+/)) {
      const w = raw.replace(/[^\p{L}]/gu, '').replace(/[ً-ْ]/g, '');
      const bare = w.replace(/^(?:و|ف)/, '');
      if (HAMZA_FORMS.has(bare)) hamzaWords++;
      else if (BARE_FORMS.has(bare)) bareAlefWords++;
    }
  }
  const multi = texts.filter((t) => nonEmptyLines(t) >= 2);
  return {
    count: n,
    medianChars: median(texts.map((t) => t.length)),
    medianLines: median(texts.map(nonEmptyLines)),
    shortShare: share((t) => nonEmptyLines(t) <= 3),
    longShare: share((t) => nonEmptyLines(t) >= 10),
    emojiShare: share((t) => EMOJI_RE.test(t)),
    bulletShare: share((t) => BULLET_LINE_RE.test(t)),
    linkShare: share((t) => LINK_RE.test(t)),
    questionEndShare: share((t) => /[؟?]\s*$/.test(t.trim())),
    longLineShare: share((t) => lineLengths(t).some((l) => l >= 90)),
    medianMaxLineChars: median(texts.map((t) => Math.max(0, ...lineLengths(t)))),
    allShortShare: share((t) => nonEmptyLines(t) >= 3 && lineLengths(t).every((l) => l < 70)),
    p90LineChars: percentile(texts.flatMap(lineLengths), 0.9),
    blankSepShare: multi.length ? multi.filter((t) => /\n[ \t]*\n/.test(t)).length / multi.length : 0,
    hamzaWords,
    bareAlefWords,
  };
}

const lineLengths = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.length);

function percentile(nums: number[], q: number): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))];
}

/** ترتيب حتمي شبه عشوائي حسب بذرة (رقم الجولة): يتغير بين الجولات ويثبت داخل الجولة */
function seededOrder(n: number, seed: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  let s = (Math.abs(seed) * 2654435761) % 4294967296 || 1;
  for (let i = n - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function describeShape(p: Post, i: number): string {
  const lens = lineLengths(p.content);
  const kind = layoutOf(p.content);
  if (kind === 'short') return `بوست ${i}: قصير جداً، ${lens.length === 1 ? 'سطر واحد' : 'سطران'} (${lens.join('، ')} حرفاً تقريباً)`;
  if (kind === 'list') {
    const items = p.content.split('\n').filter((l) => BULLET_LINE_RE.test(l)).length;
    return `بوست ${i}: سطر افتتاحي ثم قائمة من ${items} عناصر قصيرة${lens.length > items + 1 ? ' وسطر ختامي' : ''}`;
  }
  return `بوست ${i}: ${lens.length} أسطر بأطوال تقريبية ${lens.join('، ')} حرفاً${kind === 'paragraph' ? ' (أحدها فقرة من جملتين أو ثلاث)' : ' (كلها جمل قصيرة)'}`;
}

/** يضغط الحروف المكررة (اسلمممممم → اسلمم) كي تتطابق صيغ اللازمة الواحدة */
const squeeze = (s: string) => normalizeText(s).replace(/(.)\1{2,}/g, '$1$1');

/** الأسطر الافتتاحية لنصوص المستخدم (مطبّعة ومضغوطة) لكشف نسخها حرفياً في المولَّد أو في ملف الأسلوب */
export function ownOpeners(own: Post[]): string[] {
  const out = new Set<string>();
  for (const p of own) {
    const first = p.content.split('\n').map((l) => l.trim()).find(Boolean);
    const key = first ? squeeze(first) : '';
    if (key.length >= 5) out.add(key);
  }
  return [...out];
}

function matchesOpener(text: string, openers: string[]): boolean {
  const key = squeeze(text);
  if (key.length < 5) return false;
  return openers.some((o) => o === key || (key.length >= 8 && (o.startsWith(key) || key.startsWith(o))));
}

/**
 * يحذف السطر الأول من بوست مولَّد إذا كان نسخة حرفية (أو محوّرة) من افتتاحية للمستخدم:
 * النموذج يعيد "اسلمممم 🤯🔥" في كل جولة رغم المنع، والبوست بعد حذفها يقف وحده غالباً.
 */
export function stripCopiedOpener(content: string, openers: string[]): { content: string; stripped: string | null } {
  const lines = content.split('\n');
  const idx = lines.findIndex((l) => l.trim());
  if (idx < 0) return { content, stripped: null };
  const first = lines[idx].trim();
  if (!matchesOpener(first, openers)) return { content, stripped: null };
  const rest = lines
    .slice(idx + 1)
    .join('\n')
    .replace(/^\s+/, '');
  if (rest.split('\n').filter((l) => l.trim()).length < 2) return { content, stripped: null };
  return { content: rest, stripped: first };
}

/** يحذف من بند في ملف الأسلوب أي قوسين يقتبسان افتتاحية حرفية من نصوص المستخدم */
export function scrubOwnLines(text: string, openers: string[]): string {
  const out = text.replace(/\s*[(（][^)）]*[)）]/g, (seg) => {
    const inner = seg.replace(/^[\s(（]+|[)）]+$/g, '');
    return inner.split(/\s*\/\s*|\s*\|\s*|،\s*/).some((part) => matchesOpener(part, openers)) ? '' : seg;
  });
  return out.replace(/\s{2,}/g, ' ').trim();
}

/** هل هذا البند مجرد نسخة من افتتاحية للمستخدم (مثل "اسلممممم" في قائمة المفردات)؟ */
export function isOwnOpener(text: string, openers: string[]): boolean {
  return matchesOpener(text, openers);
}

/**
 * أهداف شكل بصري لكل بوست في الجولة، مأخوذة من نصوص المستخدم نفسها:
 * الوصف النثري للإحصاءات جعل نماذج Flash تكتب إما أسطراً متقطعة أو فقرات طويلة؛ الأرقام لكل بوست أدق.
 */
export function shapeTargets(own: Post[], seed: number, n = 4, opts?: { allowLists?: boolean }): string[] {
  // نستبعد الشواذ (قوائم طويلة جداً أو فقرات مقالية تتجاوز 170 حرفاً للسطر) كي لا تصبح هدفاً،
  // والقوائم كلها إذا كان المستخدم قد رفض "نظام النقاط"
  const pool = own.filter((p) => {
    const lens = lineLengths(p.content);
    if (opts?.allowLists === false && layoutOf(p.content) === 'list') return false;
    return p.content.trim().length >= 20 && lens.length <= 12 && Math.max(...lens) <= 170;
  });
  if (pool.length < n) return [];
  const order = seededOrder(pool.length, seed).map((i) => pool[i]);
  const picked: Post[] = [];
  const seen = new Set<LayoutKind>();
  for (const p of order) {
    if (picked.length >= n) break;
    const kind = layoutOf(p.content);
    if (seen.has(kind)) continue;
    picked.push(p);
    seen.add(kind);
  }
  for (const p of order) {
    if (picked.length >= n) break;
    if (!picked.includes(p)) picked.push(p);
  }
  return picked.map((p, i) => describeShape(p, i + 1));
}

/** تصنيف الشكل البصري لنص واحد: لاختيار أمثلة متنوعة الشكل */
export type LayoutKind = 'short' | 'list' | 'paragraph' | 'lines';
export function layoutOf(content: string): LayoutKind {
  const lens = lineLengths(content);
  if (lens.length <= 2) return 'short';
  if (BULLET_LINE_RE.test(content)) return 'list';
  if (lens.some((l) => l >= 90)) return 'paragraph';
  return 'lines';
}

/**
 * وصف الشكل البصري للمستخدم بصيغة تنوع لا قالب.
 * الوصف السابق ("سطر قصير لكل جملة، الوسيط 32 حرفاً") جعل النموذج يكتب كل بوست أسطراً قصيرة متساوية،
 * بينما نصف نصوص المستخدم فيها فقرة متصلة من جملتين أو ثلاث.
 */
export function describeLayout(s: CorpusStats): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const sep = s.blankSepShare >= 0.5 ? 'وسطر فارغ بين الفقرات' : 'وبلا أسطر فارغة غالباً';
  return (
    `افتتاحية قصيرة مستقلة ${sep}. ${pct(s.longLineShare)} من نصوصه فيها فقرة أو سطر طويل من جملتين أو ثلاث متصلة ` +
    `(أطول سطر وسيطه ${s.medianMaxLineChars} حرفاً، والسطر الواحد لا يتجاوز عادةً ${s.p90LineChars} حرفاً: جملتان أو ثلاث قصيرة لا خمس)، ` +
    `و${pct(s.allShortShare)} فقط كلها أسطر قصيرة متساوية، و${pct(s.shortShare)} من ثلاثة أسطر أو أقل. ` +
    `وزّع هذه الأشكال على البوستات الأربعة بهذه النسب تقريباً: لا تجعلها كلها أسطراً قصيرة متقطعة ولا كلها كتلة واحدة`
  );
}

export function renderCorpusStats(s: CorpusStats): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return [
    '=== إحصاءات محسوبة من هذه النصوص (اعتمدها في الطول والتنسيق ولا تخالفها) ===',
    `- عدد النصوص: ${s.count}`,
    `- الطول الوسيط: ${s.medianChars} حرفاً في ${s.medianLines} أسطر غير فارغة`,
    `- نصوص من 3 أسطر أو أقل: ${pct(s.shortShare)} | نصوص من 10 أسطر فأكثر: ${pct(s.longShare)}`,
    `- الشكل البصري متنوع: ${pct(s.longLineShare)} من النصوص فيها فقرة أو سطر طويل (90 حرفاً فأكثر، جملتان أو أكثر متصلتان) وأطول سطر وسيطه ${s.medianMaxLineChars} حرفاً | ${pct(s.allShortShare)} فقط كلها أسطر قصيرة متساوية | تفصل بين الفقرات بسطر فارغ: ${pct(s.blankSepShare)}`,
    `- فيها إيموجي: ${pct(s.emojiShare)} | فيها قوائم نقطية أو مرقمة: ${pct(s.bulletShare)} | فيها رابط أو منشن: ${pct(s.linkShare)} | تنتهي بسؤال: ${pct(s.questionEndShare)}`,
    `- الهمزة في أول الكلمة (أن، إذا، أكثر...): ${s.hamzaWords} مرة بالهمزة مقابل ${s.bareAlefWords} مرة بألف مجردة (ان، اذا، اكثر)`,
  ].join('\n');
}

export function buildOwnCorpusBlock(own: Post[], total: number): string {
  const head = own.length < total ? `عيّنة ممثلة: ${own.length} نصاً من أصل ${total} كتبها المستخدم بنفسه (الأحدث أولاً ثم توزيع من الأقدم)` : `${own.length} نصاً كتبها المستخدم بنفسه`;
  return `=== نصوص المستخدم — المرجع الأول لصوته ===\n${head}\n\n${renderCorpusStats(corpusStats(own))}\n\n` + own.map((p, i) => `--- نص ${i + 1} ---\n${p.content}`).join('\n\n');
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

export const DISLIKE_SYSTEM = `أنت محرر محتوى LinkedIn خبير بالسوق السعودي. يرفض المستخدم بوستاً مولّداً، ومهمتك تشخيص السبب بدقة وتحويله إلى قواعد تجنب عامة تفيد كل البوستات القادمة. كن محدداً: "نبرة وعظية في الخاتمة" أفضل من "أسلوب سيئ". إذا اختار المستخدم عدة أسباب فاكتب قاعدة مستقلة لكل سبب مختلف (حتى ثلاث)، وإلا فقاعدة واحدة.`;

export function buildDislikeUser(post: Post, profileSummary: string | null, avoidRules: string[], userReasons: string[] = []): string {
  const ctx = [
    profileSummary ? `ملخص أسلوب المستخدم: ${profileSummary}` : '',
    avoidRules.length ? `قواعد تجنب حالية (لا تكررها حرفياً): ${avoidRules.join(' | ')}` : '',
    userReasons.length
      ? `أسباب الرفض كما اختارها المستخدم بنفسه: ${userReasons.map((r) => `"${r}"`).join('، ')} — اجعل القواعد تترجم هذه الأسباب تحديداً إلى تعليمات كتابة، قاعدة لكل سبب`
      : '',
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
