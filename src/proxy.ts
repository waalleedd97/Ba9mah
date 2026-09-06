import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

/**
 * حارس الدخول: كل الصفحات والـ API تتطلب جلسة صالحة
 * ما عدا صفحة الدخول، مسارات auth، وفحص الصحة.
 */
const PUBLIC_PATHS = new Set(['/login', '/api/auth/login', '/api/auth/logout', '/api/health']);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const secret = process.env.AUTH_SECRET;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const ok = secret && secret.length >= 32 ? await verifySessionToken(token, secret) : false;

  if (ok) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized', message: 'سجّل الدخول أولاً' }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  if (pathname !== '/') url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // كل شيء ما عدا ملفات Next الثابتة والأيقونات
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|robots\\.txt).*)'],
};
