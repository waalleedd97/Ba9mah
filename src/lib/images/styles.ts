import type { ImageStylePreset, StyleStat } from '@/lib/types';

/** الأنماط الأربعة المعروضة لكل بوست */
export const IMAGE_STYLES: ImageStylePreset[] = [
  {
    key: 'bold-typography',
    label: 'خط جريء',
    prompt: `Style: Bold Typography
- Large bold Arabic headline as the hero element, nothing else
- Solid background (deep navy, black, or one rich saturated color)
- Clean modern sans-serif Arabic type, high contrast
- Think billboard: BIG text, sparse, zero clutter, no subtitles, no labels`,
  },
  {
    key: 'minimal-flat',
    label: 'مسطح بسيط',
    prompt: `Style: Minimal Flat
- Simple flat geometric shapes and icons, maximum 3 colors, lots of white space
- No gradients, no shadows, pure flat design on a light background
- TEXT LIMIT: the Arabic headline + at most 3 icon labels of 1-2 words each
- No sentences, no paragraphs, text BIG and sparse`,
  },
  {
    key: 'clean-infographic',
    label: 'إنفوجرافيك',
    prompt: `Style: Clean Infographic
- Pure white background, organized colored cards/blocks with thin dividers and subtle shadows
- Clear hierarchy: the Arabic headline big at the top, then at most 4 info blocks
- Each block = one icon + 2-3 Arabic words ONLY, one primary and one secondary accent color
- Professional, LinkedIn-optimized, no photos, no gradients, no clutter`,
  },
  {
    key: 'concept-mind-map',
    label: 'خريطة ذهنية',
    prompt: `Style: Concept Mind Map
- White or very light grey background, the central topic (max 3 Arabic words) in a bold circle in the middle
- At most 5 branches radiating outward, each branch 1-2 Arabic words, each with its own accent color
- Clean connecting lines, no sub-branches, no sentences, minimal and elegant
- Premium visual summary, billboard-style: BIG text, sparse`,
  },
];

export function getStyle(key: string): ImageStylePreset | undefined {
  return IMAGE_STYLES.find((s) => s.key === key);
}

/** ترتيب الأنماط حسب ما اختاره المستخدم وأعجبه سابقاً (بعد 6 اختيارات على الأقل) */
export function orderedStyles(stats: StyleStat[]): ImageStylePreset[] {
  const total = stats.reduce((a, s) => a + s.selected, 0);
  if (total < 6) return IMAGE_STYLES;
  const score = (key: string) => {
    const s = stats.find((x) => x.styleKey === key);
    if (!s) return 0;
    return (s.selected * 2 + s.liked * 3 - s.disliked * 2) / Math.max(s.shown, 1);
  };
  return [...IMAGE_STYLES].sort((a, b) => score(b.key) - score(a.key));
}

/** وصف نصي لتفضيلات الأنماط يُمرَّر للإخراج الفني */
export function describeStylePreference(stats: StyleStat[]): string | null {
  const total = stats.reduce((a, s) => a + s.selected, 0);
  if (total < 4) return null;
  const ranked = orderedStyles(stats);
  return `المستخدم يختار غالباً: ${ranked
    .slice(0, 2)
    .map((s) => s.label)
    .join(' ثم ')}`;
}
