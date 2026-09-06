'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon, type IconName } from '@/components/icons';
import { ThemeToggle } from '@/components/ThemeToggle';
import { api } from '@/lib/client/api';

export const NAV: Array<{ href: string; label: string; icon: IconName; match: (p: string) => boolean }> = [
  { href: '/', label: 'الرئيسية', icon: 'home', match: (p) => p === '/' || p.startsWith('/round') },
  { href: '/train', label: 'التدريب', icon: 'graduation-cap', match: (p) => p.startsWith('/train') },
  { href: '/studio', label: 'الاستوديو', icon: 'palette', match: (p) => p.startsWith('/studio') },
  { href: '/saved', label: 'المحفوظات', icon: 'bookmark', match: (p) => p.startsWith('/saved') },
  { href: '/profile', label: 'أسلوبك', icon: 'brain', match: (p) => p.startsWith('/profile') },
  { href: '/settings', label: 'الإعدادات', icon: 'settings', match: (p) => p.startsWith('/settings') },
];

export function SidebarNav({ savedCount, spec, learning, mock }: { savedCount: number; spec: string; learning: boolean; mock: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }
  return (
    <aside className="sidebar">
      <Link href="/" className="brand">
        <span className="brand-mark">
          <Icon name="fingerprint" size={22} />
        </span>
        <span>
          <div className="brand-name">بصمة</div>
          <div className="brand-sub">{spec || 'محتوى LinkedIn بأسلوبك'}</div>
        </span>
      </Link>
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} className={`nav-item ${n.match(pathname) ? 'active' : ''}`}>
          <Icon name={n.icon} size={19} />
          {n.label}
          {n.href === '/saved' && savedCount > 0 && <span className="count">{savedCount}</span>}
        </Link>
      ))}
      <div className="sidebar-foot">
        {(learning || mock) && (
          <div className="sidebar-status">
            <span className={`dot ${learning ? 'pulse' : ''}`} style={{ color: mock ? 'var(--warn)' : 'var(--violet)' }} />
            {learning ? 'بصمة يحدّث ملف أسلوبك الآن' : 'وضع الاختبار: نتائج وهمية'}
          </div>
        )}
        <ThemeToggle withLabel />
        <button className="nav-item" onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}>
          <Icon name="log-out" size={19} />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}

export function MobileBars({ savedCount }: { savedCount: number }) {
  const pathname = usePathname();
  return (
    <>
      <header className="topbar">
        <Link href="/" className="row" style={{ gap: 10 }}>
          <span className="brand-mark" style={{ width: 34, height: 34, borderRadius: 10 }}>
            <Icon name="fingerprint" size={18} />
          </span>
          <b style={{ fontSize: 17 }}>بصمة</b>
        </Link>
        <ThemeToggle />
      </header>
      <nav className="bottomnav">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={n.match(pathname) ? 'active' : ''}>
            <Icon name={n.icon} size={20} />
            {n.label}
            {n.href === '/saved' && savedCount > 0 && <span style={{ position: 'absolute', marginTop: -2, marginInlineStart: 22, fontSize: 9, background: 'var(--brand)', color: '#fff', borderRadius: 10, padding: '0 5px' }}>{savedCount}</span>}
          </Link>
        ))}
      </nav>
    </>
  );
}
