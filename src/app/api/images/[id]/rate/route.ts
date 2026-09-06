import { after } from 'next/server';
import { z } from 'zod';
import { handle, ok, readJson, idParam, HttpError } from '@/lib/api';
import { applyImageRating } from '@/lib/images/pipeline';
import { analyzeImageFeedback } from '@/lib/ai/analyze';

const Body = z.object({ liked: z.boolean() });

export const POST = handle<{ id: string }>(async (req, ctx) => {
  const id = await idParam(ctx);
  const { liked } = await readJson(req, Body);
  const image = applyImageRating(id, liked);
  if (!image) throw new HttpError(404, 'الصورة غير موجودة');
  after(() => analyzeImageFeedback(id, liked));
  return ok({ image });
});
