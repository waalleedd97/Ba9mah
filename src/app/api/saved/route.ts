import { z } from 'zod';
import { handle, ok, readJson, HttpError } from '@/lib/api';
import { findSavedByPost, getPost, insertSaved, listSaved } from '@/lib/db/repo';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => ok({ saved: listSaved() }));

const Body = z.union([
  z.object({ postId: z.string().min(1) }),
  z.object({ content: z.string().trim().min(1).max(5000), topic: z.string().trim().max(120).optional() }),
]);

export const POST = handle(async (req) => {
  const body = await readJson(req, Body);
  if ('postId' in body) {
    const post = getPost(body.postId);
    if (!post) throw new HttpError(404, 'البوست غير موجود');
    const existing = findSavedByPost(post.id);
    if (existing) return ok({ saved: existing });
    const saved = insertSaved({ postId: post.id, content: post.content, topic: post.topic, imageId: post.selectedImageId });
    return ok({ saved }, { status: 201 });
  }
  const saved = insertSaved({ content: body.content, topic: body.topic ?? '' });
  return ok({ saved }, { status: 201 });
});
