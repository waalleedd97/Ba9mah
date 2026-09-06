import { z } from 'zod';
import { handle, ok, readJson } from '@/lib/api';
import { resetAll } from '@/lib/reset';

const Body = z.object({ confirm: z.literal('RESET') });

export const POST = handle(async (req) => {
  await readJson(req, Body);
  resetAll();
  return ok({ ok: true });
});
