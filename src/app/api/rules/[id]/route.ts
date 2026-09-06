import { z } from 'zod';
import { handle, ok, readJson, idParam, HttpError } from '@/lib/api';
import { deleteRule, getRule, updateRule } from '@/lib/db/repo';

const Body = z.object({ text: z.string().trim().min(2).max(300).optional(), active: z.boolean().optional() });

export const PATCH = handle<{ id: string }>(async (req, ctx) => {
  const id = Number(await idParam(ctx));
  if (!getRule(id)) throw new HttpError(404, 'القاعدة غير موجودة');
  const body = await readJson(req, Body);
  return ok({ rule: updateRule(id, body) });
});

export const DELETE = handle<{ id: string }>(async (_req, ctx) => {
  const id = Number(await idParam(ctx));
  if (!getRule(id)) throw new HttpError(404, 'القاعدة غير موجودة');
  deleteRule(id);
  return ok({ ok: true });
});
