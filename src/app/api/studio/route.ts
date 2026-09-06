import { z } from 'zod';
import { handle, ok, readJson, HttpError } from '@/lib/api';
import { listStudioImages } from '@/lib/db/repo';
import { studioGenerate } from '@/lib/images/pipeline';
import { decodeBase64Image } from '@/lib/images/storage';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => ok({ images: listStudioImages() }));

const MAX_UPLOAD = 8 * 1024 * 1024;
const Body = z.object({
  prompt: z.string().trim().min(2).max(2000),
  image: z.string().max(MAX_UPLOAD * 1.4).optional(),
});

export const POST = handle(async (req) => {
  const { prompt, image } = await readJson(req, Body);
  let input: { base64: string; mime: string } | null = null;
  if (image) {
    const { buffer, mime } = decodeBase64Image(image);
    if (buffer.length === 0 || buffer.length > MAX_UPLOAD) throw new HttpError(413, 'الصورة أكبر من 8 ميغابايت أو غير صالحة');
    if (!mime.startsWith('image/')) throw new HttpError(400, 'الملف ليس صورة');
    input = { base64: buffer.toString('base64'), mime };
  }
  const record = await studioGenerate(prompt, input);
  return ok({ image: record }, { status: 201 });
});
