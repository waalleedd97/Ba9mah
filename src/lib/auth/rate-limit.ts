/**
 * حد بسيط لمحاولات الدخول في الذاكرة (يكفي لنسخة واحدة من التطبيق).
 * 10 محاولات فاشلة لكل IP خلال 15 دقيقة.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function prune(now: number) {
  if (buckets.size < 500) return;
  for (const [ip, b] of buckets) if (b.resetAt <= now) buckets.delete(ip);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'local';
}

/** يرجّع عدد الثواني المتبقية للحظر أو 0 إذا مسموح */
export function loginBlockedFor(ip: string): number {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt <= now) return 0;
  return b.count >= MAX_ATTEMPTS ? Math.ceil((b.resetAt - now) / 1000) : 0;
}

export function recordFailedLogin(ip: string) {
  const now = Date.now();
  prune(now);
  const b = buckets.get(ip);
  if (!b || b.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    b.count += 1;
  }
}

export function clearFailedLogins(ip: string) {
  buckets.delete(ip);
}
