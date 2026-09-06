'use client';

import { useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function getServerSnapshot(): Theme {
  return 'light';
}

function applyTheme(next: Theme) {
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem('basma-theme', next);
  } catch {}
  listeners.forEach((l) => l());
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <button
      className="theme-toggle"
      onClick={() => applyTheme(theme === 'light' ? 'dark' : 'light')}
      title={theme === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح'}
      aria-label="تبديل الثيم"
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
