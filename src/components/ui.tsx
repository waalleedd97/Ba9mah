'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from './icons';

// ---------------------------------------------------------------- Toasts
type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}
interface ToastApi {
  push: (kind: ToastKind, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((kind: ToastKind, title: string, message?: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, kind, title, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3800);
  }, []);
  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (t, m) => push('success', t, m),
      error: (t, m) => push('error', t, m),
      info: (t, m) => push('info', t, m),
    }),
    [push],
  );
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span className="t-icon">
              <Icon name={t.kind === 'success' ? 'check-circle' : t.kind === 'error' ? 'alert' : 'info'} size={18} />
            </span>
            <div>
              <div className="t-title">{t.title}</div>
              {t.message && <div className="t-msg">{t.message}</div>}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

const noop: ToastApi = { push: () => {}, success: () => {}, error: () => {}, info: () => {} };
export function useToast(): ToastApi {
  return useContext(ToastCtx) ?? noop;
}

// ---------------------------------------------------------------- Primitives
export function Button({
  children,
  variant = 'default',
  size,
  block,
  icon,
  loading,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'lg';
  block?: boolean;
  icon?: IconName;
  loading?: boolean;
}) {
  const cls = ['btn', variant !== 'default' ? `btn-${variant}` : '', size ? `btn-${size}` : '', block ? 'btn-block' : '', className].filter(Boolean).join(' ');
  return (
    <button className={cls} disabled={rest.disabled || loading} {...rest}>
      {loading ? <Icon name="loader" size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : icon ? <Icon name={icon} size={18} /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, size, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; size?: 'sm' }) {
  return (
    <button className={`btn btn-icon ${size ? `btn-${size}` : ''} ${className}`} title={label} aria-label={label} {...rest}>
      <Icon name={icon} size={size === 'sm' ? 16 : 18} />
    </button>
  );
}

export function Pill({ children, tone = '', icon }: { children: React.ReactNode; tone?: '' | 'brand' | 'violet' | 'success' | 'danger' | 'warn' | 'info'; icon?: IconName }) {
  return (
    <span className={`pill ${tone}`}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

export function SectionTitle({ icon, tone = '', children, action }: { icon: IconName; tone?: '' | 'violet' | 'success' | 'danger' | 'warn' | 'info'; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="section-title" style={{ justifyContent: 'space-between' }}>
      <span className="row" style={{ gap: 10 }}>
        <span className={`icon-bubble ${tone}`}>
          <Icon name={icon} size={18} />
        </span>
        {children}
      </span>
      {action}
    </div>
  );
}

export function Stat({ icon, tone = '', value, label }: { icon: IconName; tone?: '' | 'violet' | 'success' | 'danger' | 'warn' | 'info'; value: React.ReactNode; label: string }) {
  return (
    <div className="stat">
      <span className={`icon-bubble ${tone || 'info'}`} style={tone === '' ? { background: 'var(--brand-soft)', color: 'var(--brand)' } : undefined}>
        <Icon name={icon} size={20} />
      </span>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} title={label} onClick={() => onChange(!on)} />;
}

export function EmptyState({ icon, title, text, children }: { icon: IconName; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="empty fade-up">
      <div className="icon-bubble">
        <Icon name={icon} size={26} />
      </div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children && <div className="mt-2 row center">{children}</div>}
    </div>
  );
}

export function Stepper({ items }: { items: Array<'done' | 'active' | 'pending' | 'bad'> }) {
  return (
    <div className="stepper" aria-hidden>
      {items.map((s, i) => (
        <span key={i} className={s === 'pending' ? '' : s} />
      ))}
    </div>
  );
}

export function Confidence({ level }: { level: 'low' | 'medium' | 'high' }) {
  const n = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  return (
    <span className="confidence" title={`ثقة ${level === 'high' ? 'عالية' : level === 'medium' ? 'متوسطة' : 'منخفضة'}`}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= n ? 'on' : ''} />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------- Post preview (LinkedIn-like)
export function PostPreview({
  content,
  author = 'أنت',
  subtitle,
  collapsible = true,
  children,
  editing,
}: {
  content: string;
  author?: string;
  subtitle?: string;
  collapsible?: boolean;
  children?: React.ReactNode;
  editing?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = collapsible && (content.length > 600 || content.split('\n').length > 12);
  return (
    <article className={`post-preview ${editing ? 'editing' : ''}`}>
      <header className="pp-head">
        <span className="avatar">
          <Icon name="fingerprint" size={22} />
        </span>
        <div>
          <div className="pp-name">{author}</div>
          <div className="pp-meta">
            {subtitle && <span>{subtitle} ·</span>}
            <span>الآن</span>
            <Icon name="globe" size={12} />
          </div>
        </div>
      </header>
      {editing ?? (
        <>
          <div className={`pp-body ${long && !expanded ? 'collapsed' : ''}`}>{content}</div>
          {long && (
            <button className="pp-more" onClick={() => setExpanded((e) => !e)}>
              {expanded ? 'عرض أقل' : '…عرض المزيد'}
            </button>
          )}
        </>
      )}
      {children}
      <footer className="pp-foot" aria-hidden>
        <span>
          <Icon name="heart" size={15} /> إعجاب
        </span>
        <span>
          <Icon name="message-circle" size={15} /> تعليق
        </span>
        <span>
          <Icon name="repeat" size={15} /> إعادة نشر
        </span>
        <span>
          <Icon name="send" size={15} /> إرسال
        </span>
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------- Generation loader
const GEN_STEPS = ['يقرأ ملف أسلوبك وقواعدك', 'يختار أمثلة متنوعة من إعجاباتك', 'يكتب 4 بوستات بزوايا مختلفة', 'يراجعها ضد القواعد وأسباب الرفض', 'يتحقق من المعلومات ويجهّز الجولة'];

export function GenerationLoader({ title, subtitle }: { title: string; subtitle?: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, GEN_STEPS.length - 1)), 9000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="hero">
      <div className="hero-inner scale-in" style={{ maxWidth: 520, textAlign: 'center' }}>
        <div className="ring" style={{ margin: '0 auto 22px' }}>
          <Icon name="sparkles" size={28} style={{ color: 'var(--brand)' }} />
        </div>
        <h2 style={{ fontSize: 24, marginBottom: 8 }}>{title}</h2>
        {subtitle && <p className="muted" style={{ marginBottom: 22 }}>{subtitle}</p>}
        <div className="gen-steps">
          {GEN_STEPS.map((s, i) => (
            <div key={s} className={`gen-step ${i < step ? 'done' : i === step ? 'active' : ''}`}>
              <Icon name={i < step ? 'check-circle' : i === step ? 'loader' : 'more'} size={16} style={i === step ? { animation: 'spin 1s linear infinite' } : undefined} />
              {s}
            </div>
          ))}
        </div>
        <p className="subtle mt-2">الجولة تأخذ عادة من 30 إلى 90 ثانية</p>
      </div>
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%', r = 10 }: { h?: number; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}
