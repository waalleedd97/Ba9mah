import 'server-only';
import zlib from 'node:zlib';
import { GoogleGenAI } from '@google/genai';
import { getEnv, requireGeminiKey, ConfigError } from '@/lib/env';
import { logEvent } from '@/lib/db/repo';
import { AIError } from '@/lib/ai/anthropic';

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: requireGeminiKey(), httpOptions: { timeout: 180_000 } });
  return client;
}

export interface GenerateImageInput {
  prompt: string;
  /** صورة مدخلة للتعديل عليها */
  input?: { base64: string; mime: string } | null;
  /** لتلوين الصورة الوهمية في وضع الاختبار */
  mockSeed?: string;
}

export interface GeneratedImage {
  buffer: Buffer;
  mime: string;
  text: string;
}

/** توليد أو تعديل صورة عبر Gemini (Nano Banana 2 افتراضياً) */
export async function generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
  const env = getEnv();
  const started = Date.now();

  if (env.mockAi) {
    const buffer = solidPng(320, colorFromSeed(input.mockSeed ?? input.prompt));
    logEvent({ kind: 'image', model: 'mock', durationMs: 0 });
    return { buffer, mime: 'image/png', text: '' };
  }

  try {
    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [{ text: input.prompt }];
    if (input.input) parts.push({ inlineData: { data: input.input.base64, mimeType: input.input.mime } });

    const res = await getClient().models.generateContent({
      model: env.GEMINI_IMAGE_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: { aspectRatio: '1:1', imageSize: '1K' },
      },
    });

    let image: { data: string; mime: string } | null = null;
    let text = '';
    for (const part of res.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data && !image) image = { data: part.inlineData.data, mime: part.inlineData.mimeType ?? 'image/png' };
      if (part.text) text += part.text;
    }

    if (!image) {
      const reason = res.promptFeedback?.blockReason ?? res.candidates?.[0]?.finishReason ?? 'no_image';
      logEvent({ kind: 'image', model: env.GEMINI_IMAGE_MODEL, durationMs: Date.now() - started, ok: false, note: String(reason) });
      throw new AIError(`لم يرجع Gemini صورة (${reason})${text ? `: ${text.slice(0, 200)}` : ''}`, 'api');
    }

    logEvent({ kind: 'image', model: env.GEMINI_IMAGE_MODEL, durationMs: Date.now() - started, ok: true });
    return { buffer: Buffer.from(image.data, 'base64'), mime: image.mime, text };
  } catch (err) {
    if (err instanceof AIError) throw err;
    const message = err instanceof ConfigError ? err.message : describeGeminiError(err);
    logEvent({ kind: 'image', model: env.GEMINI_IMAGE_MODEL, durationMs: Date.now() - started, ok: false, note: message });
    throw new AIError(message, err instanceof ConfigError ? 'config' : 'api');
  }
}

function describeGeminiError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/API key not valid|API_KEY_INVALID|401|403/i.test(msg)) return 'مفتاح GEMINI_API_KEY غير صالح أو غير مفعّل لهذا النموذج';
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) return 'تجاوزنا حصة Gemini، حاول بعد قليل';
  if (/404|not found/i.test(msg)) return `نموذج الصور ${getEnv().GEMINI_IMAGE_MODEL} غير متاح لحسابك`;
  return `خطأ من Gemini: ${msg.slice(0, 300)}`;
}

// ---------- صورة وهمية لوضع الاختبار: PNG بلون واحد بدون مكتبات ----------

function colorFromSeed(seed: string): [number, number, number] {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return hslToRgb(hue, 0.55, 0.55);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])) >>> 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

export function solidPng(size: number, rgb: [number, number, number]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = rgb[0];
    row[2 + x * 3] = rgb[1];
    row[3 + x * 3] = rgb[2];
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
