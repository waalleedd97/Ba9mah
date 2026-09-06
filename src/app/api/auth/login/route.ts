import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { handle, readJson, fail } from '@/lib/api';
import { requireAuthConfig } from '@/lib/env';
import { clearFailedLogins, clientIp, loginBlockedFor, recordFailedLogin } from '@/lib/auth/rate-limit';
import { SESSION_DAYS, createSessionToken, passwordMatches, sessionCookie } from '@/lib/auth/session';

const Body = z.object({ password: z.string().min(1).max(200) });

export const POST = handle(async (req: NextRequest) => {
  const ip = clientIp(req);
  const blocked = loginBlockedFor(ip);
  if (blocked > 0) return fail(429, `محاولات كثيرة. حاول بعد ${Math.ceil(blocked / 60)} دقيقة`, 'ratelimit');

  const { password } = await readJson(req, Body);
  const { password: expected, secret } = requireAuthConfig();

  if (!passwordMatches(password, expected)) {
    recordFailedLogin(ip);
    return fail(401, 'كلمة المرور غير صحيحة', 'unauthorized');
  }

  clearFailedLogins(ip);
  const token = await createSessionToken(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie(req, token, SESSION_DAYS * 24 * 60 * 60));
  return res;
});
