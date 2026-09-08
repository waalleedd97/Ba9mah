import 'server-only';
import type { NewsBrief } from '@/lib/types';
import { getSpec } from '@/lib/db/repo';
import { AIError, imageBlock, systemText, textCall, type NewsSource, type UserBlock } from './gemini';

export interface NewsInput {
  text?: string | null;
  image?: { base64: string; mime: string } | null;
}

const URL_RE = /https?:\/\/[^\s<>"'()\]]+/gi;
const MAX_ARTICLES = 2;
const ARTICLE_CHARS = 8000;

/** يمنع جلب عناوين داخلية (SSRF): فقط http/https إلى مضيفين عامين */
function isPublicHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false;
    if (/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.test(h)) {
      const [a, b] = h.split('.').map(Number);
      if (a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) return false;
    }
    if (h.includes(':')) return false; // IPv6 الحرفي
    return true;
  } catch {
    return false;
  }
}

/** تحويل HTML إلى نص مقروء: يفضّل <article> أو <main>، ويحذف السكربتات والأنماط والوسوم */
export function htmlToText(html: string): string {
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(clean)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
  const body = /<article[\s\S]*?<\/article>/i.exec(clean)?.[0] ?? /<main[\s\S]*?<\/main>/i.exec(clean)?.[0] ?? clean;
  const text = body
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/h[1-6]>|<\/li>|<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t\r]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
  return (title ? `${title}\n` : '') + text;
}

async function fetchArticle(url: string): Promise<{ title: string; text: string } | null> {
  if (!isPublicHttpUrl(url)) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; BasmaBot/1.0; +https://basma.njd-services.net)',
        accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
        'accept-language': 'ar,en;q=0.8',
      },
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml|text\/plain/i.test(type)) return null;
    const raw = (await res.text()).slice(0, 1_500_000);
    const text = (/html/i.test(type) ? htmlToText(raw) : raw).slice(0, ARTICLE_CHARS).trim();
    if (text.length < 80) return null;
    const title = text.split('\n')[0].slice(0, 120);
    return { title, text };
  } catch {
    return null;
  }
}

const RESEARCH_SYSTEM = `أنت محرر أخبار تقنية وأعمال تحضّر ملخصاً دقيقاً لكاتب محتوى LinkedIn سعودي. يعطيك المستخدم خبراً: نصاً أو عنواناً أو رابطاً أو صورة شاشة. مهمتك فهم الخبر، ثم البحث عنه للتأكد من الحقائق وإكمال ما ينقص إن كان البحث متاحاً لك، وإلا فالاعتماد على المعطى فقط.

اكتب بالعربية بهذا الشكل بالضبط وبلا أي مقدمات:
العنوان: سطر واحد يلخص الخبر
الملخص: ما حدث، من، متى، الأرقام والتفاصيل المؤكدة، ولماذا يهم القارئ، في 5 إلى 10 أسطر بلا إنشاء
غير مؤكد: ما لم تجد له مصدراً موثوقاً، أو "لا شيء"

لا تختلق أرقاماً أو تصريحات أو تواريخ. إذا كان المعطى رأياً أو تغريدة لا خبراً فقل ذلك في الملخص واشرح الخبر الذي تدور حوله. إذا كانت الصورة غير مقروءة فقل ذلك.`;

function parseBrief(text: string): { headline: string; brief: string } {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const idx = lines.findIndex((l) => /^العنوان\s*[:：]/.test(l));
  const headline = (idx >= 0 ? lines[idx].replace(/^العنوان\s*[:：]\s*/, '') : lines[0] ?? 'خبر').slice(0, 200);
  const rest = lines.filter((_, i) => i !== idx).join('\n');
  return { headline, brief: rest.slice(0, 3000) };
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * يبحث عن الخبر ويلخصه قبل كتابة جولة عنه:
 * 1) الروابط في النص تُقرأ مباشرة من الموقع (لا يحتاج بحثاً).
 * 2) البحث في Google عبر Gemini إن كان متاحاً للمفتاح (يتطلب فوترة مفعّلة).
 * 3) وإلا يُكتب الملخص من النص والصورة المعطاة فقط، مع ملاحظة واضحة للمستخدم.
 */
export async function researchNews(input: NewsInput): Promise<NewsBrief> {
  const text = (input.text ?? '').trim();
  if (!text && !input.image) throw new AIError('أعطني نص الخبر أو رابطه أو صورته', 'config');

  const urls = [...new Set((text.match(URL_RE) ?? []).map((u) => u.replace(/[.,،؛;!؟?]+$/, '')))].slice(0, MAX_ARTICLES);
  const articles = (await Promise.all(urls.map(async (url) => ({ url, article: await fetchArticle(url) })))).filter((a) => a.article);

  const today = new Date().toISOString().slice(0, 10);
  const parts: UserBlock[] = [];
  if (input.image) parts.push(imageBlock(input.image.base64, input.image.mime));
  parts.push({
    text:
      `التخصص الذي يكتب فيه المستخدم: ${getSpec() || 'ريادة الأعمال والتقنية'}\nتاريخ اليوم: ${today}\n\n` +
      `=== ما أعطاه المستخدم ===\n${text || '(صورة فقط، اقرأ الخبر منها)'}` +
      articles.map(({ url, article }) => `\n\n=== نص الصفحة ${url} ===\n${article!.text}`).join(''),
  });

  const system = [systemText(RESEARCH_SYSTEM)];
  let result: { text: string; sources: NewsSource[] } | null = null;
  let searched = false;
  let note: string | null = null;
  try {
    const r = await textCall({ kind: 'news_research', system, user: parts, effort: 'medium', maxTokens: 3000, search: true, mockHint: text });
    result = r;
    searched = true;
  } catch (err) {
    // البحث في Google غير متاح على الحصة المجانية (429 على كل النماذج) → نكتب من المعطى فقط
    console.warn('[news] search unavailable, writing from the given text only:', err instanceof Error ? err.message : err);
    const r = await textCall({ kind: 'news_research', system, user: parts, effort: 'medium', maxTokens: 3000, search: false, mockHint: text });
    result = r;
    note = articles.length
      ? 'البحث في الويب غير متاح على مفتاح Gemini الحالي (يحتاج فوترة مفعّلة)، فاعتمدت على نص الرابط الذي أعطيتني.'
      : 'البحث في الويب غير متاح على مفتاح Gemini الحالي (يحتاج فوترة مفعّلة)، فاعتمدت على ما أعطيتني فقط.';
  }

  const { headline, brief } = parseBrief(result.text);
  if (!brief) throw new AIError('لم أفهم الخبر من المعطى، جرّب نصاً أوضح أو رابط الخبر', 'parse');
  const seen = new Set<string>();
  const sources: NewsSource[] = [];
  for (const s of [...articles.map((a) => ({ title: a.article!.title || hostnameOf(a.url), url: a.url })), ...result.sources]) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    sources.push(s);
  }
  return { headline, brief, sources: sources.slice(0, 8), searched, note };
}
