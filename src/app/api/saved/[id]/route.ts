import { z } from 'zod';
import { handle, ok, readJson, idParam, HttpError } from '@/lib/api';
import { deleteSaved, getSaved, updateSaved } from '@/lib/db/repo';

const Body = z.object({ content: z.string().trim().min(1).max(5000).optional(), topic: z.string().trim().max(120).optional() });

export const PATCH = handle<{ id: string }>(async (req, ctx) => {
  const id = await idParam(ctx);
  if (!getSaved(id)) throw new HttpError(404, 'المحفوظ غير موجود');
  const body = await readJson(req, Body);
  return ok({ saved: updateSaved(id, body) });
});

export const DELETE = handle<{ id: string }>(async (_req, ctx) => {
  const id = await idParam(ctx);
  if (!getSaved(id)) throw new HttpError(404, 'المحفوظ غير موجود');
  deleteSaved(id);
  return ok({ ok: true });
});
