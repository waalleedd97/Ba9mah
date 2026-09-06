'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ThemeToggle } from './ThemeToggle';

const TABS: Array<{ href: string; label: string; match: (p: string) => boolean }> = [
  { href: '/', label: 'التوليد', match: (p) => p === '/' || p.startsWith('/round') },
  { href: '/train', label: 'التدريب', match: (p) => p.startsWith('/train') },
  { href: '/studio', label: 'الصور', match: (p) => p.startsWith('/studio') },
  { href: '/saved', label: 'المحفوظات', match: (p) => p.startsWith('/saved') },
  { href: '/profile', label: 'الأسلوب', match: (p) => p.startsWith('/profile') },
];

export function Navbar({ savedCount }: { savedCount: number }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-inner">
        <Link href="/" className="navbar-brand">
          <img src="/icon.svg" alt="" width={28} height={28} style={{ borderRadius: 8, verticalAlign: 'middle' }} /> بصمة
        </Link>
        <div className="navbar-tabs">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className={`nav-tab ${t.match(pathname) ? 'active' : ''}`}>
              {t.label}
              {t.href === '/saved' && savedCount > 0 && <span className="badge">{savedCount}</span>}
            </Link>
          ))}
          <Link href="/settings" className={`nav-tab ${pathname.startsWith('/settings') ? 'active' : ''}`} title="الإعدادات">
            ⚙️
          </Link>
        </div>
        <ThemeToggle />
      </div>
    </nav>
  );
}
