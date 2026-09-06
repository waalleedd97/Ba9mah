import { z } from 'zod';
import { handle, ok, readJson, idParam, HttpError } from '@/lib/api';
import { getSaved, updateSaved } from '@/lib/db/repo';
import { editWithAI } from '@/lib/ai/edit';

const Body = z.object({ instruction: z.string().trim().min(2).max(1000) });

export const POST = handle<{ id: string }>(async (req, ctx) => {
  const id = await idParam(ctx);
  const saved = getSaved(id);
  if (!saved) throw new HttpError(404, 'المحفوظ غير موجود');
  const { instruction } = await readJson(req, Body);
  const result = await editWithAI(saved.content, instruction);
  return ok({ saved: updateSaved(id, { content: result.content }), summary: result.summary });
});
