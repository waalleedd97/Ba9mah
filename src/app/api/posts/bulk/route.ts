import { after } from 'next/server';
import { z } from 'zod';
import { handle, ok, readJson } from '@/lib/api';
import { insertOwnPosts } from '@/lib/db/repo';
import { relearnProfile } from '@/lib/ai/learn';

const Body = z.object({
  posts: z.array(z.string().max(8000)).min(1).max(500),
  own: z.boolean().default(true),
});

/** استيراد بالجملة لنصوص المستخدم (أو نصوص يحب أسلوبها)، ثم تحديث ملف الأسلوب في الخلفية */
export const POST = handle(async (req) => {
  const { posts, own } = await readJson(req, Body);
  const result = insertOwnPosts(posts, own ? 'own' : 'reference');
  if (result.added > 0) {
    after(async () => {
      try {
        await relearnProfile('manual', { force: true });
      } catch (err) {
        console.error('[bulk] relearn failed:', err instanceof Error ? err.message : err);
      }
    });
  }
  return ok({ ...result, relearning: result.added > 0 });
});
