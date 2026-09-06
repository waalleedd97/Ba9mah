import { z } from 'zod';
import { handle, ok, readJson } from '@/lib/api';
import { insertPost, listPostsByRating } from '@/lib/db/repo';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  const url = new URL(req.url);
  const rating = url.searchParams.get('rating') === 'disliked' ? 'disliked' : 'liked';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 100) || 100, 500);
  return ok({ posts: listPostsByRating(rating, limit) });
});

const Body = z.object({ content: z.string().trim().min(10).max(5000), topic: z.string().trim().max(120).optional() });

/** إضافة بوست مرجعي يدوياً (يُعامل كمعجَب به) */
export const POST = handle(async (req) => {
  const { content, topic } = await readJson(req, Body);
  const ts = Date.now();
  const post = insertPost({ kind: 'reference', content, topic: topic || 'مرجع يدوي', rating: 'liked', ratedAt: ts });
  return ok({ post }, { status: 201 });
});
