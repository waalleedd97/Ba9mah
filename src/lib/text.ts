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

/** محلل CSV بسيط يدعم الاقتباس والأسطر داخل الحقول (مثل Shares.csv من LinkedIn) */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

const SEP_LINE = /^[ \t]*(?:-{3,}|\*{3,}|={3,}|_{3,}|#{3,}|•{3,}|~{3,})[ \t]*$/m;

/** قطعة تبدأ بشَرطة قائمة أو منشن أو علامة تعداد: تكملة للبوست السابق لا بوست مستقل */
const LIST_FRAGMENT = /^(?:[-•*▪◦]\s|@[A-Za-z0-9_]{2,}|[✅✔☑️➡️👈👉]|\d+[.)-]\s|[١-٩][.)-]\s)/u;

/**
 * يضم القطع التي هي تكملة قائمة إلى البوست السابق. بوست فيه قائمة مفصولة بأسطر فارغة
 * (مثل قائمة حاضنات ومسرعات بمنشن لكل واحدة) كان يتحول إلى عشرة "بوستات" من سطرين.
 */
function mergeListFragments(parts: string[]): string[] {
  const out: string[] = [];
  for (const p of parts) {
    if (out.length && LIST_FRAGMENT.test(p)) out[out.length - 1] += `\n\n${p}`;
    else out.push(p);
  }
  return out;
}

/** يقسم نصاً طويلاً إلى بوستات: بسطر فاصل (--- أو ***) أو بسطرين فارغين متتاليين */
export function splitPosts(input: string): string[] {
  const text = input.replace(/\r\n?/g, '\n');
  let parts: string[];
  if (SEP_LINE.test(text)) parts = text.split(new RegExp(SEP_LINE.source, 'm'));
  else if (/\n[ \t]*\n[ \t]*\n/.test(text)) parts = mergeListFragments(text.split(/\n[ \t]*\n(?:[ \t]*\n)+/).map((p) => p.trim()).filter(Boolean));
  else parts = [text];
  return parts.map((p) => p.trim()).filter((p) => p.length >= 20);
}

const CONTENT_COLUMNS = ['sharecommentary', 'commentary', 'content', 'text', 'post', 'body', 'message', 'النص', 'المحتوى'];

/** يستخرج البوستات من ملف: CSV (LinkedIn Shares.csv وغيره)، JSON، أو نص عادي */
export function extractPosts(fileName: string, content: string): string[] {
  const name = fileName.toLowerCase();
  if (name.endsWith('.csv')) {
    const rows = parseCsv(content);
    if (rows.length > 1) {
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const idx = header.findIndex((h) => CONTENT_COLUMNS.includes(h));
      if (idx >= 0) return rows.slice(1).map((r) => (r[idx] ?? '').trim()).filter((s) => s.length >= 20);
      // بدون عنوان معروف: أطول عمود نصي
      const widest = header.map((_, i) => rows.slice(1).reduce((a, r) => a + (r[i]?.length ?? 0), 0)).reduce((best, v, i, arr) => (v > arr[best] ? i : best), 0);
      return rows.slice(1).map((r) => (r[widest] ?? '').trim()).filter((s) => s.length >= 20);
    }
  }
  if (name.endsWith('.json')) {
    try {
      const j: unknown = JSON.parse(content);
      const arr = Array.isArray(j) ? j : typeof j === 'object' && j ? ((j as Record<string, unknown>).posts ?? (j as Record<string, unknown>).items ?? (j as Record<string, unknown>).likedPosts ?? []) : [];
      if (Array.isArray(arr)) {
        return arr
          .map((x) => (typeof x === 'string' ? x : typeof x === 'object' && x ? String((x as Record<string, unknown>).content ?? (x as Record<string, unknown>).text ?? (x as Record<string, unknown>).ShareCommentary ?? (x as Record<string, unknown>).body ?? '') : ''))
          .map((s) => s.trim())
          .filter((s) => s.length >= 20);
      }
    } catch {
      /* نص عادي */
    }
  }
  return splitPosts(content);
}

/** إزالة التكرار بعد التطبيع مع الحفاظ على الترتيب */
export function dedupePosts(posts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of posts) {
    const k = normalizeText(p);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}
