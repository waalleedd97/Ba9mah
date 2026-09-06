import { handle, ok, idParam, HttpError } from '@/lib/api';
import { getRound, listImagesForPost, listPostsByRound, findSavedByPost } from '@/lib/db/repo';

export const dynamic = 'force-dynamic';

export const GET = handle<{ id: string }>(async (_req, ctx) => {
  const id = Number(await idParam(ctx));
  const round = Number.isFinite(id) ? getRound(id) : null;
  if (!round) throw new HttpError(404, 'الجولة غير موجودة');
  const posts = listPostsByRound(round.id).map((p) => ({
    ...p,
    images: listImagesForPost(p.id),
    savedId: findSavedByPost(p.id)?.id ?? null,
  }));
  return ok({ round, posts });
});
