import { z } from 'zod';
import { handle, ok, readJson, idParam, HttpError } from '@/lib/api';
import { getPost, listImagesForPost, listStyleStats } from '@/lib/db/repo';
import { generatePostImage } from '@/lib/images/pipeline';
import { orderedStyles } from '@/lib/images/styles';

export const dynamic = 'force-dynamic';

export const GET = handle<{ id: string }>(async (_req, ctx) => {
  const id = await idParam(ctx);
  if (!getPost(id)) throw new HttpError(404, 'البوست غير موجود');
  return ok({ images: listImagesForPost(id), styles: orderedStyles(listStyleStats()).map(({ key, label }) => ({ key, label })) });
});

const Body = z.object({ styleKey: z.string().min(1).max(40) });

export const POST = handle<{ id: string }>(async (req, ctx) => {
  const id = await idParam(ctx);
  const post = getPost(id);
  if (!post) throw new HttpError(404, 'البوست غير موجود');
  const { styleKey } = await readJson(req, Body);
  const image = await generatePostImage(post, styleKey);
  return ok({ image }, { status: 201 });
});
