import { handle, ok, idParam, HttpError } from '@/lib/api';
import { deleteImageRow, getImage, getImageFile, getPost, setSelectedImage, updateSaved, getSaved } from '@/lib/db/repo';
import { deleteImageFile, imageFileExists, readImageFile } from '@/lib/images/storage';

export const dynamic = 'force-dynamic';

export const GET = handle<{ id: string }>(async (_req, ctx) => {
  const id = await idParam(ctx);
  const ref = getImageFile(id);
  if (!ref || !imageFileExists(ref.fileName)) throw new HttpError(404, 'الصورة غير موجودة');
  const bytes = readImageFile(ref.fileName);
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': ref.mime,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
});

export const DELETE = handle<{ id: string }>(async (_req, ctx) => {
  const id = await idParam(ctx);
  const img = getImage(id);
  if (!img) throw new HttpError(404, 'الصورة غير موجودة');
  if (img.postId && getPost(img.postId)?.selectedImageId === id) setSelectedImage(img.postId, null);
  if (img.savedPostId && getSaved(img.savedPostId)?.imageId === id) updateSaved(img.savedPostId, { imageId: null });
  const ref = deleteImageRow(id);
  if (ref) deleteImageFile(ref.fileName);
  return ok({ ok: true });
});
