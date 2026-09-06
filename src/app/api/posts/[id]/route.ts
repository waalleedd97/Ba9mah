import { z } from 'zod';
import { handle, ok, readJson, idParam, HttpError } from '@/lib/api';
import { deletePost, getPost, updatePostContent, updatePostTopic } from '@/lib/db/repo';
import { findSavedByPost, updateSaved } from '@/lib/db/repo';

function syncSavedCopy(postId: string, content: string) {
  const saved = findSavedByPost(postId);
  if (saved) updateSaved(saved.id, { content });
}

const Body = z.object({ content: z.string().trim().min(1).max(5000).optional(), topic: z.string().trim().max(120).optional() });

export const PATCH = handle<{ id: string }>(async (req, ctx) => {
  const id = await idParam(ctx);
  if (!getPost(id)) throw new HttpError(404, 'البوست غير موجود');
  const body = await readJson(req, Body);
  if (body.content !== undefined) {
    updatePostContent(id, body.content);
    syncSavedCopy(id, body.content);
  }
  if (body.topic !== undefined) updatePostTopic(id, body.topic);
  return ok({ post: getPost(id) });
});

export const DELETE = handle<{ id: string }>(async (_req, ctx) => {
  const id = await idParam(ctx);
  if (!getPost(id)) throw new HttpError(404, 'البوست غير موجود');
  deletePost(id);
  return ok({ ok: true });
});
