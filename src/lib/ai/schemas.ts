import { z } from 'zod';

/** أشكال البوست التي ينوّع بينها المولّد داخل الجولة الواحدة */
export const FORMATS = [
  'خبر أو أداة جديدة مع تعليق سريع',
  'قائمة أدوات أو مصادر مفيدة',
  'قصة من تجربة',
  'رأي يخالف السائد',
  'درس عملي بمثال',
  'ملاحظة من الواقع',
  'سؤال حقيقي يحيّر الكاتب',
  'تفكيك فكرة شائعة',
  'خلف الكواليس',
  'اعتراف بخطأ',
  'مقارنة بين طريقتين',
] as const;

export const GeneratedPostSchema = z.object({
  topic: z.string().describe('عنوان الموضوع في 3 إلى 6 كلمات'),
  angle: z.string().describe('الزاوية أو الفكرة المحورية للبوست في جملة واحدة'),
  hook_type: z.string().describe('شكل البوست من قائمة الأشكال المحددة'),
  exploratory: z.boolean().describe('true إذا كان البوست استكشافياً يجرب افتتاحية أو بنية غير معتادة'),
  content: z.string().describe('نص البوست كاملاً كما سيُنشر على LinkedIn بدون أي شرح'),
});
export const GenerationSchema = z.object({
  posts: z.array(GeneratedPostSchema).describe('أربعة بوستات مختلفة تماماً'),
});
export type GeneratedPost = z.infer<typeof GeneratedPostSchema>;

export const StyleProfileSchema = z.object({
  summary: z.string().describe('وصف الأسلوب في جملتين أو ثلاث'),
  voice: z.string().describe('النبرة واللهجة والشخصية الكتابية'),
  structure: z.string().describe('البنية المعتادة: الافتتاحية، الجسم، الخاتمة'),
  length: z.string().describe('الطول المفضل بالأسطر أو الكلمات'),
  hooks: z.array(z.string()).describe('أنواع الافتتاحيات التي نجحت'),
  formatting: z.string().describe('التنسيق: الترقيم، الفواصل، الإيموجي، الهاشتاقات'),
  vocabulary: z.array(z.string()).describe('كلمات وتعابير مميزة يستخدمها الكاتب'),
  signature_moves: z.array(z.string()).describe('حركات كتابية مميزة تتكرر في المعجَب بها'),
  do_not: z.array(z.string()).describe('ما يجب تجنبه استناداً للمرفوض وأسبابه'),
  topics_that_work: z.array(z.string()).describe('مواضيع أو زوايا تلقى إعجاباً'),
  confidence: z.enum(['low', 'medium', 'high']).describe('مدى الثقة بناءً على حجم البيانات'),
});
export type StyleProfileOutput = z.infer<typeof StyleProfileSchema>;

/** مخرجات التعلم: الملف نفسه + إعادة صياغة القواعد المتعلَّمة في قائمة قصيرة متسقة مع نصوص المستخدم */
export const LearnOutputSchema = StyleProfileSchema.extend({
  avoid_rules_consolidated: z
    .array(z.string())
    .describe('القواعد المتعلَّمة بعد المراجعة: حتى 8 قواعد قصيرة (120 حرفاً) بلا تكرار ولا تناقض مع نصوص المستخدم؛ فارغة إن لم تُرفق قواعد متعلَّمة'),
});
export type LearnOutput = z.infer<typeof LearnOutputSchema>;

export const DislikeAnalysisSchema = z.object({
  reason: z.string().describe('السبب الأرجح للرفض في جملة واحدة'),
  category: z.enum(['tone', 'length', 'structure', 'hook', 'content', 'language', 'repetition', 'other']),
  avoid_rules: z.array(z.string()).describe('من قاعدة إلى ثلاث قواعد عامة قصيرة تبدأ بـ "لا" أو "تجنب"، قاعدة مستقلة لكل سبب مختلف، تصلح لكل البوستات القادمة'),
  confidence: z.enum(['low', 'medium', 'high']),
});

export const ImageDislikeSchema = z.object({
  reason: z.string().describe('السبب الأرجح لرفض الصورة بناءً على ما تراه فعلاً فيها'),
  category: z.enum(['text', 'colors', 'layout', 'style', 'relevance', 'quality', 'clutter', 'other']),
  avoid_rule: z.string().describe('قاعدة قصيرة بالعربية تصف ما يجب تجنبه في الصور القادمة'),
});

export const ImageLikeSchema = z.object({
  what_worked: z.string().describe('ما الذي نجح في هذه الصورة تحديداً'),
  style_rule: z.string().describe('قاعدة إيجابية قصيرة بالعربية تصف ما يجب تكراره'),
  reusable: z.boolean().describe('هل القاعدة عامة وتصلح لمواضيع أخرى؟'),
});

export const EditSchema = z.object({
  content: z.string().describe('النص المعدّل كاملاً'),
  changes_summary: z.string().describe('ملخص التغييرات في جملة'),
});

export const LaborLawSchema = z.object({
  posts: z.array(
    z.object({
      index: z.number().int().describe('رقم البوست كما ورد في الطلب'),
      changed: z.boolean(),
      content: z.string().describe('النص بعد التصحيح أو كما هو'),
      corrections: z.array(
        z.object({
          claim: z.string().describe('المعلومة الخاطئة كما وردت'),
          correction: z.string().describe('المعلومة الصحيحة'),
          article: z.string().describe('رقم المادة المرجعية'),
        }),
      ),
    }),
  ),
});

export const ArtDirectionSchema = z.object({
  headline: z.string().describe('عبارة عربية قوية من 4 إلى 7 كلمات تُرسم داخل الصورة'),
  concept: z.string().describe('الفكرة البصرية المركزية في جملة'),
  prompts: z.array(
    z.object({
      style_key: z.string(),
      prompt: z.string().describe('وصف الصورة بالإنجليزية لهذا النمط، مع ذكر النص العربي حرفياً'),
    }),
  ),
});
export type ArtDirection = z.infer<typeof ArtDirectionSchema>;
