import { z } from 'zod';
import { handle, ok, readJson, HttpError } from '@/lib/api';
import { isOnboarded } from '@/lib/db/repo';
import { generateRound } from '@/lib/ai/generate';

const Body = z.object({ topic: z.string().max(200).optional() });

export const POST = handle(async (req) => {
  if (!isOnboarded()) throw new HttpError(409, 'أكمل الإعداد الأولي أولاً');
  const { topic } = await readJson(req, Body);
  const { round, posts } = await generateRound(topic);
  return ok({ round, posts });
});
