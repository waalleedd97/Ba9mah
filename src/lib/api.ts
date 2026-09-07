import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { z } from 'zod';
import { AIError } from '@/lib/ai/gemini';
import { ConfigError } from '@/lib/env';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, message: string, code = 'error') {
  return NextResponse.json({ error: code, message }, { status });
}

export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, 'جسم الطلب ليس JSON صالحاً');
  }
  const r = schema.safeParse(body);
  if (!r.success) {
    const issues = r.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('، ');
    throw new HttpError(400, `بيانات الطلب غير صالحة: ${issues}`);
  }
  return r.data as z.infer<S>;
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return fail(err.status, err.message);
  if (err instanceof AIError) {
    const status = err.code === 'config' ? 500 : err.code === 'ratelimit' ? 429 : err.code === 'auth' ? 500 : 502;
    return fail(status, err.message, err.code);
  }
  if (err instanceof ConfigError) return fail(500, err.message, 'config');
  console.error('[api] unhandled error:', err);
  return fail(500, err instanceof Error ? err.message : 'خطأ غير متوقع');
}

type Ctx<P> = { params: Promise<P> };
type Handler<P> = (req: NextRequest, ctx: Ctx<P>) => Promise<Response>;

/** يلف المعالج ويحوّل الأخطاء إلى ردود JSON موحدة */
export function handle<P = Record<string, never>>(fn: Handler<P>): Handler<P> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function idParam<P extends { id: string }>(ctx: Ctx<P>): Promise<string> {
  const { id } = await ctx.params;
  if (!id || id.length > 64) throw new HttpError(400, 'معرّف غير صالح');
  return id;
}
