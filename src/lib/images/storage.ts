import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { imagesDir } from '@/lib/db';
import { newId } from '@/lib/ids';

const SAFE_NAME = /^[a-z0-9_-]+\.(png|jpg|jpeg|webp|gif)$/i;

export function extForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'png';
  }
}

function resolveSafe(fileName: string): string {
  if (!SAFE_NAME.test(fileName)) throw new Error('اسم ملف غير صالح');
  const dir = imagesDir();
  const full = path.resolve(dir, fileName);
  if (!full.startsWith(dir + path.sep)) throw new Error('مسار غير مسموح');
  return full;
}

export function saveImageFile(buffer: Buffer, mime: string, id = newId('img')): { id: string; fileName: string; bytes: number } {
  const fileName = `${id}.${extForMime(mime)}`;
  fs.mkdirSync(imagesDir(), { recursive: true });
  fs.writeFileSync(resolveSafe(fileName), buffer);
  return { id, fileName, bytes: buffer.length };
}

export function readImageFile(fileName: string): Buffer {
  return fs.readFileSync(resolveSafe(fileName));
}

export function imageFileExists(fileName: string): boolean {
  try {
    return fs.existsSync(resolveSafe(fileName));
  } catch {
    return false;
  }
}

export function deleteImageFile(fileName: string) {
  try {
    fs.rmSync(resolveSafe(fileName), { force: true });
  } catch (err) {
    console.error('[storage] delete failed', err);
  }
}

/** فك data URL أو base64 خام */
export function decodeBase64Image(input: string): { buffer: Buffer; mime: string } {
  const m = /^data:([a-z0-9.+/-]+);base64,(.*)$/i.exec(input);
  const mime = m ? m[1].toLowerCase() : 'image/png';
  const data = m ? m[2] : input;
  return { buffer: Buffer.from(data, 'base64'), mime };
}
