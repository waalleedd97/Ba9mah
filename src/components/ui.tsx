'use client';

import { useEffect, useState } from 'react';

export function Spinner({ emoji = '🌊', size = 36 }: { emoji?: string; size?: number }) {
  return (
    <div className="loader-ring" style={{ margin: '0 auto' }}>
      <span style={{ fontSize: size, zIndex: 1, animation: 'pulse 2s ease-in-out infinite' }}>{emoji}</span>
    </div>
  );
}

export function ErrorToast({ message, onClose }: { message: string; onClose?: () => void }) {
  useEffect(() => {
    if (!onClose) return;
    const t = setTimeout(onClose, 9000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div className="error-toast" role="alert" style={{ marginBottom: 16 }}>
      ⚠️ {message}
    </div>
  );
}

export function SuccessFlash({ message }: { message: string }) {
  if (!message) return null;
  return <div className="success-flash" style={{ marginBottom: 16 }}>✓ {message}</div>;
}

/** رسالة نجاح تختفي تلقائياً */
export function useFlash(ms = 3000) {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), ms);
    return () => clearTimeout(t);
  }, [msg, ms]);
  return [msg, setMsg] as const;
}

export function Icon3D({ children, color = 'accent', size = 'sm' }: { children: React.ReactNode; color?: string; size?: 'sm' | 'lg' }) {
  return <div className={`icon-3d icon-3d-${size} ${color}`}>{children}</div>;
}

export function SectionHeader({ icon, color, title, subtitle }: { icon: string; color: string; title: string; subtitle?: string }) {
  return (
    <div className="train-header">
      <Icon3D color={color}>{icon}</Icon3D>
      <div>
        <h3 style={{ color: `var(--${color})` }}>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}

export function EmptyState({ emoji, text, children }: { emoji: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="card fade-in" style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>{emoji}</div>
      <p className="note" style={{ fontSize: 15 }}>{text}</p>
      {children && <div style={{ marginTop: 16 }}>{children}</div>}
    </div>
  );
}

export function LoadingScreen({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="center-screen">
      <div className="fade-in" style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ marginBottom: 28 }}>
          <Spinner />
        </div>
        <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10, color: 'var(--text-primary)' }}>{title}</h3>
        {subtitle && <p className="note" style={{ marginBottom: 24 }}>{subtitle}</p>}
        <div style={{ width: 200, height: 4, borderRadius: 2, background: 'var(--bg-secondary)', margin: '0 auto', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div className="shimmer-bar" />
        </div>
      </div>
    </div>
  );
}
