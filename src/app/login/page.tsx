import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { Icon } from '@/components/icons';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

export const metadata = { title: 'الدخول — بصمة' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const secret = process.env.AUTH_SECRET;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (secret && secret.length >= 32 && (await verifySessionToken(token, secret))) redirect('/');
  const { next } = await searchParams;
  return (
    <div className="hero">
      <div className="hero-inner text-center" style={{ maxWidth: 460 }}>
        <div className="brand-hero" style={{ margin: '0 auto 22px' }}>
          <Icon name="fingerprint" size={38} />
        </div>
        <h1 className="hero-title" style={{ marginBottom: 8 }}>بصمة</h1>
        <p className="hero-sub" style={{ margin: '0 auto 28px' }}>محتوى LinkedIn يتعلم أسلوبك مع كل تقييم</p>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
