import { NextResponse, type NextRequest } from 'next/server';
import { sessionCookie } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie(req, '', 0));
  return res;
}
