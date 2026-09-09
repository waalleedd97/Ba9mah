import 'server-only';
import type { NewsBrief } from '@/lib/types';
import { getSpec } from '@/lib/db/repo';
import { getEnv } from '@/lib/env';
import { normalizeText } from '@/lib/text';
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

// ---------------------------------------------------------------- أمر حر

const COMMAND_SYSTEM = `أنت مساعد بحث لكاتب محتوى LinkedIn سعودي. يعطيك المستخدم أمراً حراً بلغته (مثل: "ابحث في النت وش مستجدات الذكاء الاصطناعي اليوم والبزنس والتقنية واكتب لي بوستات")، ومهمتك تحضير المادة التي سيُكتب منها، لا كتابة البوستات.

افهم الأمر أولاً: ما المواضيع المطلوبة؟ هل يحتاج بحثاً في الويب (مستجدات، أخبار اليوم، أرقام حديثة) أم يكفي ما في الأمر نفسه؟ كم بوستاً طلب (إن لم يحدد فأربعة، والحد الأقصى أربعة)؟ وما القيود التي ذكرها (لغة، نبرة، طول، جمهور، صيغة)؟
إن احتاج بحثاً فابحث الآن واجمع أهم التطورات الحديثة فعلاً (بتاريخ اليوم أو الأيام القليلة الماضية) لكل موضوع طلبه، بحقائقها وأرقامها ومصادرها.

اكتب بالعربية بهذا الشكل بالضبط وبلا مقدمات:
العنوان: وصف الطلب في نصف سطر
عدد البوستات: رقم من 1 إلى 4
قيود المستخدم: ما ذكره أو "لا شيء"
المادة:
1. <تطور أو فكرة> — <الحقائق والأرقام المؤكدة> (<المصدر>، <التاريخ>)
2. ...
غير مؤكد: ما لم تجد له مصدراً، أو "لا شيء"

لا تختلق أرقاماً أو تصريحات. اجعل عدد بنود المادة أكبر من عدد البوستات كي يكون للكاتب خيارات.`;

/** ينفذ أمراً حراً: يفهمه، يبحث إن لزم، ويعيد مادة الكتابة وعدد البوستات المطلوب */
export async function researchCommand(command: string): Promise<NewsBrief> {
  const text = command.trim();
  if (text.length < 5) throw new AIError('اكتب أمرك بجملة واضحة', 'config');
  const today = new Date().toISOString().slice(0, 10);
  const parts: UserBlock[] = [{ text: `التخصص الذي يكتب فيه المستخدم: ${getSpec() || 'ريادة الأعمال والتقنية'}\nتاريخ اليوم: ${today}\n\n=== أمر المستخدم ===\n${text}` }];
  const system = [systemText(COMMAND_SYSTEM)];
  let result: { text: string; sources: NewsSource[] };
  let searched = false;
  try {
    result = await textCall({ kind: 'command_research', system, user: parts, effort: 'medium', maxTokens: 4000, search: true, mockHint: text });
    searched = true;
  } catch (err) {
    console.warn('[news] search unavailable for the command, answering from the command only:', err instanceof Error ? err.message : err);
    result = await textCall({ kind: 'command_research', system, user: parts, effort: 'medium', maxTokens: 4000, search: false, mockHint: text });
  }
  const { headline, brief } = parseBrief(result.text);
  const countMatch = /عدد البوستات\s*[:：]\s*([1-4١-٤])/.exec(result.text);
  const digits: Record<string, number> = { '١': 1, '٢': 2, '٣': 3, '٤': 4 };
  const count = countMatch ? (digits[countMatch[1]] ?? Number(countMatch[1])) : 4;
  if (!brief) throw new AIError('ما فهمت الأمر، اكتبه بصيغة أوضح', 'parse');
  return {
    headline: headline || text.slice(0, 120),
    brief,
    sources: result.sources.slice(0, 8),
    searched,
    note: searched ? null : 'بحث Gemini في الويب غير متاح الآن؛ نُفذ الأمر من نصه فقط.',
    command: text,
    count: Math.min(4, Math.max(1, count)),
  };
}

// ---------------------------------------------------------------- آخر أخبار موضوع

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  /** ISO date أو فارغ */
  date: string;
  snippet: string;
}

const MAX_ITEMS = 12;
const MAX_AGE_DAYS = 45;
const DIGEST_ARTICLES = 3;

function unescapeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block: string, name: string): string {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(block);
  return m ? unescapeXml(m[1]) : '';
}

/** روابط Bing تمر عبر apiclick.aspx وتحمل الرابط الحقيقي في المعامل url */
function realUrl(link: string): string {
  try {
    const u = new URL(link);
    if (/bing\.com$/i.test(u.hostname) && u.searchParams.get('url')) return u.searchParams.get('url')!;
  } catch {
    /* رابط غير صالح: يُعاد كما هو */
  }
  return link;
}

/** محلل RSS خفيف يكفي لخلاصات الأخبار (بلا مكتبة XML) */
export function parseRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = m[1];
    const title = tag(block, 'title');
    const link = realUrl(tag(block, 'link'));
    if (!title || !link) continue;
    const pub = tag(block, 'pubDate');
    const d = pub ? new Date(pub) : null;
    items.push({
      title,
      url: link,
      source: tag(block, 'source') || tag(block, 'News:Source') || hostnameOf(link),
      date: d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '',
      snippet: tag(block, 'description').slice(0, 300),
    });
  }
  return items;
}

async function fetchRss(url: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; BasmaBot/1.0; +https://basma.njd-services.net)', accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5' },
    });
    if (!res.ok) return [];
    return parseRss((await res.text()).slice(0, 2_000_000));
  } catch {
    return [];
  }
}

/**
 * آخر الأخبار عن موضوع من خلاصات الأخبار العامة (بلا مفاتيح): Bing News ثم Google News،
 * دمج وحذف المكرر، الأحدث أولاً، وخلال آخر 45 يوماً.
 */
export async function searchLatestNews(query: string): Promise<NewsItem[]> {
  if (getEnv().mockAi) {
    return [0, 1, 2].map((i) => ({ title: `خبر تجريبي ${i + 1} عن ${query}`, url: `https://example.com/news/${i + 1}`, source: 'مصدر تجريبي', date: new Date().toISOString().slice(0, 10), snippet: 'مقتطف وهمي في وضع الاختبار' }));
  }
  const q = encodeURIComponent(query.trim());
  const [bingAr, bingEn, google] = await Promise.all([
    fetchRss(`https://www.bing.com/news/search?q=${q}&format=rss&mkt=ar-SA`),
    fetchRss(`https://www.bing.com/news/search?q=${q}&format=rss&mkt=en-US`),
    fetchRss(`https://news.google.com/rss/search?q=${q}%20when%3A45d&hl=ar&gl=SA&ceid=SA:ar`),
  ]);
  const seen = new Set<string>();
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const merged: NewsItem[] = [];
  for (const it of [...bingAr, ...bingEn, ...google]) {
    const key = normalizeText(it.title).slice(0, 60);
    if (!key || seen.has(key)) continue;
    if (it.date && new Date(it.date).getTime() < cutoff) continue;
    seen.add(key);
    merged.push(it);
  }
  merged.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return merged.slice(0, MAX_ITEMS);
}

const DIGEST_SYSTEM = `أنت محرر أخبار تقنية وأعمال تحضّر ملخصاً لكاتب محتوى LinkedIn سعودي. يعطيك المستخدم موضوعاً وقائمة بآخر الأخبار عنه من خلاصات الأخبار (عناوين، مصادر، تواريخ، مقتطفات) ونصوص بعض المقالات. إن كان البحث في الويب متاحاً لك فاستعن به للتأكد وإكمال ما ينقص.

اختر أهم 3 إلى 5 تطورات حديثة فعلاً (الأحدث والأكثر أثراً على القارئ التقني ورائد الأعمال في السعودية)، وتجاهل القديم والمكرر والإعلاني والتحليلات الإنشائية.

اكتب بالعربية بهذا الشكل بالضبط وبلا مقدمات:
العنوان: آخر أخبار <الموضوع>: <أهم تطور في نصف سطر>
التطورات:
1. <التطور> — <الحقائق والأرقام المؤكدة> (<المصدر>، <التاريخ>)
2. ...
غير مؤكد: ما لم تجد له مصدراً، أو "لا شيء"

لا تختلق أرقاماً أو تصريحات. إذا كانت الأخبار كلها هامشية فقل ذلك.`;

/** يبحث عن آخر أخبار موضوع ويلخص أهم تطوراته قبل كتابة جولة عنها */
export async function researchTopic(query: string): Promise<NewsBrief> {
  const topic = query.trim();
  if (topic.length < 2) throw new AIError('اكتب الموضوع الذي تريد آخر أخباره', 'config');
  const items = await searchLatestNews(topic);
  if (items.length === 0) throw new AIError(`ما لقيت أخباراً حديثة عن "${topic}"، جرّب صياغة أخرى أو موضوعاً أوسع`, 'unavailable');

  // نصوص أهم المقالات (روابط Bing مباشرة؛ روابط Google News مشفّرة لا تُقرأ)
  const readable = items.filter((it) => !/news\.google\.com/i.test(it.url)).slice(0, DIGEST_ARTICLES);
  const articles = getEnv().mockAi ? [] : (await Promise.all(readable.map(async (it) => ({ it, article: await fetchArticle(it.url) })))).filter((a) => a.article);

  const today = new Date().toISOString().slice(0, 10);
  const list = items.map((it, i) => `${i + 1}. ${it.title} | ${it.source}${it.date ? ` | ${it.date}` : ''}${it.snippet ? `\n   ${it.snippet}` : ''}`).join('\n');
  const parts: UserBlock[] = [
    {
      text:
        `التخصص الذي يكتب فيه المستخدم: ${getSpec() || 'ريادة الأعمال والتقنية'}\nتاريخ اليوم: ${today}\nالموضوع: ${topic}\n\n=== آخر الأخبار من الخلاصات (${items.length}) ===\n${list}` +
        articles.map(({ it, article }) => `\n\n=== نص المقال: ${it.title} (${it.url}) ===\n${article!.text.slice(0, 5000)}`).join(''),
    },
  ];
  const system = [systemText(DIGEST_SYSTEM)];
  let result: { text: string; sources: NewsSource[] };
  let searched = false;
  try {
    result = await textCall({ kind: 'news_digest', system, user: parts, effort: 'medium', maxTokens: 3000, search: true, mockHint: topic });
    searched = true;
  } catch (err) {
    console.warn('[news] search unavailable, digesting the feeds only:', err instanceof Error ? err.message : err);
    result = await textCall({ kind: 'news_digest', system, user: parts, effort: 'medium', maxTokens: 3000, search: false, mockHint: topic });
  }
  const { headline, brief } = parseBrief(result.text);
  if (!brief) throw new AIError('لم أستطع تلخيص الأخبار، جرّب موضوعاً آخر', 'parse');
  const seen = new Set<string>();
  const sources: NewsSource[] = [];
  for (const s of [...items.slice(0, 6).map((it) => ({ title: `${it.source}: ${it.title}`.slice(0, 80), url: it.url })), ...result.sources]) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    sources.push(s);
  }
  return {
    headline: headline.startsWith('آخر أخبار') ? headline : `آخر أخبار ${topic}: ${headline}`.slice(0, 200),
    brief,
    sources: sources.slice(0, 8),
    searched,
    note: searched ? null : `جمعت ${items.length} خبراً من خلاصات الأخبار العامة (Bing وGoogle News) وقرأت ${articles.length} مقالاً؛ بحث Gemini في الويب غير متاح على مفتاحك الحالي (يحتاج فوترة).`,
    query: topic,
  };
}
