import { after } from 'next/server';
import { z } from 'zod';
import { handle, ok, readJson, idParam, HttpError } from '@/lib/api';
import { addDislikeReason, addRule, completeRound, getPost, ratePost, roundIsFullyRated } from '@/lib/db/repo';
import { analyzeDislikedPost } from '@/lib/ai/analyze';
import { maybeRelearn } from '@/lib/ai/learn';
import { NO_LISTS_REASON, NO_LISTS_RULE } from '@/lib/seed';

const Reason = z.string().trim().min(1).max(120);
const Body = z.object({
  liked: z.boolean(),
  /** سبب واحد (توافق مع النسخة السابقة) */
  reason: Reason.optional(),
  /** عدة أسباب مختارة من الشرائح أو مكتوبة يدوياً */
  reasons: z.array(Reason).max(8).optional(),
});

export const POST = handle<{ id: string }>(async (req, ctx) => {
  const id = await idParam(ctx);
  const post = getPost(id);
  if (!post) throw new HttpError(404, 'البوست غير موجود');
  const { liked, reason, reasons: list } = await readJson(req, Body);
  const reasons = liked ? [] : [...new Set([...(list ?? []), ...(reason ? [reason] : [])])];

  const updated = ratePost(id, liked ? 'liked' : 'disliked')!;
  let roundDone = false;
  if (updated.roundId != null && roundIsFullyRated(updated.roundId)) {
    completeRound(updated.roundId);
    roundDone = true;
  }

  // أسباب المستخدم تُحفظ فوراً؛ و"نظام النقاط" يصبح قاعدة ثابتة بلا انتظار التحليل
  for (const r of reasons) addDislikeReason(id, r, 'user');
  if (reasons.includes(NO_LISTS_REASON)) addRule('avoid', NO_LISTS_RULE, 'manual');

  // التحليل والتعلم بعد إرسال الرد — لا ينتظرهما المستخدم
  after(async () => {
    if (!liked) await analyzeDislikedPost(id, reasons);
    await maybeRelearn();
  });

  return ok({ post: updated, roundDone });
});
