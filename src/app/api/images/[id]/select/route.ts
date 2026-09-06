import { handle, ok, idParam, HttpError } from '@/lib/api';
import { selectImage } from '@/lib/images/pipeline';

export const POST = handle<{ id: string }>(async (_req, ctx) => {
  const id = await idParam(ctx);
  const image = selectImage(id);
  if (!image) throw new HttpError(404, 'الصورة غير موجودة');
  return ok({ image });
});
