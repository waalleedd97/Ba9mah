'use client';

import { useSyncExternalStore } from 'react';
import { Icon } from './icons';

type Theme = 'light' | 'dark';
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const getSnapshot = (): Theme => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
const getServerSnapshot = (): Theme => 'dark';

export function applyTheme(next: Theme) {
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem('basma-theme', next);
  } catch {}
  listeners.forEach((l) => l());
}

export function ThemeToggle({ withLabel }: { withLabel?: boolean }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const next: Theme = theme === 'light' ? 'dark' : 'light';
  return (
    <button className={withLabel ? 'nav-item' : 'btn btn-icon btn-ghost'} onClick={() => applyTheme(next)} title={next === 'dark' ? 'الوضع الداكن' : 'الوضع الفاتح'} aria-label="تبديل الثيم">
      <Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} />
      {withLabel && (theme === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح')}
    </button>
  );
}
