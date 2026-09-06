import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

export const metadata = { title: 'الدخول — بصمة' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const secret = process.env.AUTH_SECRET;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (secret && secret.length >= 32 && (await verifySessionToken(token, secret))) redirect('/');
  const { next } = await searchParams;
  return (
    <div className="center-screen">
      <div className="container" style={{ textAlign: 'center' }}>
        <img src="/icon.svg" alt="بصمة" width={72} height={72} style={{ borderRadius: 20, display: 'block', margin: '0 auto 24px' }} />
        <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 6 }}>بصمة</h1>
        <p className="note" style={{ marginBottom: 28 }}>مولّد محتوى LinkedIn يتعلم ذوقك</p>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
