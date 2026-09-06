import { after } from 'next/server';
import { z } from 'zod';
import { handle, ok, readJson, idParam, HttpError } from '@/lib/api';
import { addDislikeReason, completeRound, getPost, ratePost, roundIsFullyRated } from '@/lib/db/repo';
import { analyzeDislikedPost } from '@/lib/ai/analyze';
import { maybeRelearn } from '@/lib/ai/learn';

const Body = z.object({ liked: z.boolean(), reason: z.string().trim().max(120).optional() });

export const POST = handle<{ id: string }>(async (req, ctx) => {
  const id = await idParam(ctx);
  const post = getPost(id);
  if (!post) throw new HttpError(404, 'البوست غير موجود');
  const { liked, reason } = await readJson(req, Body);

  const updated = ratePost(id, liked ? 'liked' : 'disliked')!;
  let roundDone = false;
  if (updated.roundId != null && roundIsFullyRated(updated.roundId)) {
    completeRound(updated.roundId);
    roundDone = true;
  }

  // التحليل والتعلم بعد إرسال الرد — لا ينتظرهما المستخدم
  if (!liked && reason) addDislikeReason(id, reason, 'user');

  after(async () => {
    if (!liked) await analyzeDislikedPost(id, reason);
    await maybeRelearn();
  });

  return ok({ post: updated, roundDone });
});
