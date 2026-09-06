/**
 * جلسة الدخول — توقيع HMAC-SHA256 عبر Web Crypto ليعمل نفس الكود
 * في proxy.ts وفي route handlers بدون الاعتماد على node:crypto.
 */
export const SESSION_COOKIE = 'basma_session';
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(secret: string, days = SESSION_DAYS): Promise<string> {
  const exp = Date.now() + days * 24 * 60 * 60 * 1000;
  const payload = `v1.${exp}`;
  const sig = await hmacHex(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = await hmacHex(secret, `${parts[0]}.${parts[1]}`);
  return constantTimeEqual(expected, parts[2]);
}

/** هل الطلب وصل عبر HTTPS (مباشرة أو خلف reverse proxy)؟ */
export function isSecureRequest(req: Request): boolean {
  const forwarded = req.headers.get('x-forwarded-proto');
  if (forwarded) return forwarded.split(',')[0].trim() === 'https';
  try {
    return new URL(req.url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function sessionCookie(req: Request, value: string, maxAgeSeconds: number) {
  return {
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: isSecureRequest(req),
    maxAge: maxAgeSeconds,
  };
}

/** مقارنة كلمة المرور بزمن ثابت */
export function passwordMatches(input: string, expected: string): boolean {
  return constantTimeEqual(input, expected);
}
