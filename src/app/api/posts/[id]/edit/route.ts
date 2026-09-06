import { z } from 'zod';
import { handle, ok, readJson, idParam, HttpError } from '@/lib/api';
import { getPost, updatePostContent } from '@/lib/db/repo';
import { findSavedByPost, updateSaved } from '@/lib/db/repo';

function syncSavedCopy(postId: string, content: string) {
  const saved = findSavedByPost(postId);
  if (saved) updateSaved(saved.id, { content });
}
import { editWithAI } from '@/lib/ai/edit';

const Body = z.object({ instruction: z.string().trim().min(2).max(1000) });

export const POST = handle<{ id: string }>(async (req, ctx) => {
  const id = await idParam(ctx);
  const post = getPost(id);
  if (!post) throw new HttpError(404, 'البوست غير موجود');
  const { instruction } = await readJson(req, Body);
  const result = await editWithAI(post.content, instruction);
  const updated = updatePostContent(id, result.content);
  syncSavedCopy(id, result.content);
  return ok({ post: updated, summary: result.summary });
});
