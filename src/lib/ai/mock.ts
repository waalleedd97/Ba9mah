/**
 * نتائج وهمية لوضع BASMA_MOCK_AI=1 — لاختبار الواجهة والتدفق بدون مفاتيح.
 * كل مخرج يُتحقق منه بالـ schema الحقيقي عند الاستخدام كي يبقى مطابقاً.
 */
const TOPICS = ['التسعير الجريء', 'أول عميل', 'الشراكة الصحيحة', 'التوقف في الوقت المناسب', 'قراءة الأرقام', 'المنتج الممل'];

export function mockFor(kind: string, hint?: string): unknown {
  const seed = (hint ?? '').length;
  switch (kind) {
    case 'generate':
      return {
        posts: [0, 1, 2, 3].map((i) => {
          const t = hint?.trim() ? `${hint.trim()} — زاوية ${i + 1}` : TOPICS[(seed + i) % TOPICS.length];
          return {
            topic: t,
            angle: `زاوية تجريبية رقم ${i + 1} عن ${t}`,
            hook_type: ['سؤال مباشر', 'قصة شخصية', 'قائمة', 'رقم أو حقيقة'][i],
            exploratory: i >= 2,
            content: `[وضع الاختبار] بوست رقم ${i + 1} عن ${t}.\n\nهذا نص وهمي يُظهر شكل البوست في الواجهة.\n\n1. نقطة أولى\n2. نقطة ثانية\n3. نقطة ثالثة`,
          };
        }),
      };
    case 'learn':
      return {
        summary: 'أسلوب سعودي أبيض مباشر، جمل قصيرة، يبدأ بسؤال أو حقيقة ثم قائمة عملية.',
        voice: 'ودود ومباشر بدون وعظ',
        structure: 'افتتاحية قصيرة، فراغ، جسم من 3 إلى 6 أسطر، خاتمة عملية',
        length: '5 إلى 10 أسطر',
        hooks: ['سؤال مباشر', 'رقم أو حقيقة'],
        formatting: 'أسطر قصيرة مفصولة بفراغ، ترقيم عند النصائح، بدون إيموجي',
        vocabulary: ['تبغى', 'خلني أختصر عليك', 'الطريقة الصحيحة'],
        signature_moves: ['مقارنة الطريقة الخاطئة بالصحيحة', 'ختم البوست بجملة تطبيقية'],
        do_not: ['لا تستخدم فصحى ثقيلة', 'لا تطوّل بلا فائدة'],
        topics_that_work: ['التحقق من الفكرة', 'التعلم من الفشل'],
        confidence: 'medium',
        avoid_rules_consolidated: [],
      };
    case 'analyze_dislike':
      return { reason: 'نبرة وعظية وطول زائد', category: 'tone', avoid_rules: ['تجنب النبرة الوعظية والجمل الطويلة'], confidence: 'medium' };
    case 'news_research':
      return `العنوان: ${(hint ?? 'خبر تجريبي').split('\n')[0].slice(0, 80)}\n\nالملخص: هذا ملخص وهمي لخبر في وضع الاختبار. الحقائق: أُعلن الخبر اليوم، ويهم جمهور التقنية وريادة الأعمال.\n\nالمصادر: لا يوجد بحث في وضع الاختبار.`;
    case 'analyze_image_dislike':
      return { reason: 'نص كثير وصغير داخل الصورة', category: 'clutter', avoid_rule: 'تجنب النصوص الكثيرة الصغيرة داخل الصورة' };
    case 'analyze_image_like':
      return { what_worked: 'عنوان كبير واضح وخلفية نظيفة', style_rule: 'عنوان واحد كبير على خلفية نظيفة', reusable: true };
    case 'edit':
      return { content: `[معدّل] ${hint ?? ''}`.trim(), changes_summary: 'تعديل وهمي في وضع الاختبار' };
    case 'verify':
      return { posts: [] };
    case 'art_direction':
      return {
        headline: (hint ?? 'فكرة تستحق النشر').split(/\s+/).slice(0, 5).join(' '),
        concept: 'مفهوم بصري بسيط يعبّر عن الموضوع',
        prompts: ['bold-typography', 'minimal-flat', 'clean-infographic', 'concept-mind-map'].map((k) => ({
          style_key: k,
          prompt: `Mock prompt for ${k}`,
        })),
      };
    default:
      return {};
  }
}
