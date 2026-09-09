import { z } from 'zod';
import { handle, ok, readJson, HttpError } from '@/lib/api';
import { isOnboarded } from '@/lib/db/repo';
import { generateRound } from '@/lib/ai/generate';
import { researchNews, researchTopic } from '@/lib/ai/news';
import { decodeBase64Image } from '@/lib/images/storage';

const MAX_UPLOAD = 8 * 1024 * 1024;
const Body = z.object({
  topic: z.string().max(200).optional(),
  /** جولة عن خبر: نص أو عنوان أو رابط، و/أو صورة شاشة للخبر (data URL) */
  news: z
    .object({
      text: z.string().trim().max(6000).optional(),
      image: z.string().max(MAX_UPLOAD * 1.4).optional(),
    })
    .optional(),
  /** جولة عن آخر أخبار موضوع: يتصفح خلاصات الأخبار ويلخص أهم التطورات ثم يكتب */
  newsSearch: z.object({ query: z.string().trim().min(2).max(200) }).optional(),
});

export const POST = handle(async (req) => {
  if (!isOnboarded()) throw new HttpError(409, 'أكمل الإعداد الأولي أولاً');
  const { topic, news, newsSearch } = await readJson(req, Body);

  if (newsSearch) {
    const brief = await researchTopic(newsSearch.query);
    const { round, posts } = await generateRound(brief.headline, brief);
    return ok({ round, posts });
  }

  if (news) {
    let image: { base64: string; mime: string } | null = null;
    if (news.image) {
      const { buffer, mime } = decodeBase64Image(news.image);
      if (buffer.length === 0 || buffer.length > MAX_UPLOAD) throw new HttpError(413, 'الصورة أكبر من 8 ميغابايت أو غير صالحة');
      if (!mime.startsWith('image/')) throw new HttpError(400, 'الملف ليس صورة');
      image = { base64: buffer.toString('base64'), mime };
    }
    if (!news.text && !image) throw new HttpError(400, 'أعطني نص الخبر أو رابطه أو صورته');
    const brief = await researchNews({ text: news.text, image });
    const { round, posts } = await generateRound(brief.headline, brief);
    return ok({ round, posts });
  }

  const { round, posts } = await generateRound(topic);
  return ok({ round, posts });
});
