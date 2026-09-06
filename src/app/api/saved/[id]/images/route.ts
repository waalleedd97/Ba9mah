import { z } from 'zod';
import { handle, ok, readJson, idParam, HttpError } from '@/lib/api';
import { getSaved, listImagesForSaved, listStyleStats } from '@/lib/db/repo';
import { generateSavedImage } from '@/lib/images/pipeline';
import { orderedStyles } from '@/lib/images/styles';

export const dynamic = 'force-dynamic';

export const GET = handle<{ id: string }>(async (_req, ctx) => {
  const id = await idParam(ctx);
  if (!getSaved(id)) throw new HttpError(404, 'المحفوظ غير موجود');
  return ok({ images: listImagesForSaved(id), styles: orderedStyles(listStyleStats()).map(({ key, label }) => ({ key, label })) });
});

const Body = z.object({ styleKey: z.string().min(1).max(40) });

export const POST = handle<{ id: string }>(async (req, ctx) => {
  const id = await idParam(ctx);
  const saved = getSaved(id);
  if (!saved) throw new HttpError(404, 'المحفوظ غير موجود');
  const { styleKey } = await readJson(req, Body);
  const image = await generateSavedImage(saved, styleKey);
  return ok({ image }, { status: 201 });
});
