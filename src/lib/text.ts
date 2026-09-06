/** أدوات نص عربية خفيفة — آمنة للاستخدام في السيرفر والواجهة */

/** تطبيع: إزالة التشكيل، توحيد الألف والتاء المربوطة والياء، حذف الرموز */
export function normalizeText(s: string): string {
  return s
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const STOP = new Set(['في', 'من', 'على', 'عن', 'الى', 'إلى', 'ان', 'أن', 'او', 'أو', 'مع', 'هذا', 'هذه', 'ما', 'لا', 'كل', 'اللي', 'the', 'and', 'of', 'to']);

/** كلمات مميزة (3 أحرف فأكثر، بدون كلمات التوقف) */
export function keywords(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of normalizeText(s).split(' ')) {
    const t = w.replace(/^(ال|و|ب|ل|ك|ف)/, '');
    if (t.length >= 3 && !STOP.has(t) && !STOP.has(w)) out.add(t);
  }
  return out;
}

/** تشابه Jaccard بين مجموعتي كلمات */
export function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** تاريخ ووقت بصيغة رقمية ثابتة (ميلادي، توقيت الرياض) — متطابق بين السيرفر والمتصفح */
export function formatDate(ts: number): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(ts));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const h = Number(get('hour'));
    const suffix = h >= 12 ? 'م' : 'ص';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${get('year')}/${get('month')}/${get('day')} · ${h12}:${get('minute')} ${suffix}`;
  } catch {
    return new Date(ts).toISOString().slice(0, 16).replace('T', ' ');
  }
}
