import { z } from 'zod';
import { handle, ok, readJson, HttpError } from '@/lib/api';
import { addRule, listRules } from '@/lib/db/repo';

export const dynamic = 'force-dynamic';

const Kind = z.enum(['golden', 'avoid', 'image_style', 'image_avoid']);

export const GET = handle(async (req) => {
  const kind = Kind.safeParse(new URL(req.url).searchParams.get('kind'));
  return ok({ rules: listRules(kind.success ? kind.data : undefined, false) });
});

const Body = z.object({ kind: Kind, text: z.string().trim().min(2).max(300) });

export const POST = handle(async (req) => {
  const { kind, text } = await readJson(req, Body);
  const rule = addRule(kind, text, 'manual');
  if (!rule) throw new HttpError(409, 'هذه القاعدة موجودة مسبقاً');
  return ok({ rule }, { status: 201 });
});
