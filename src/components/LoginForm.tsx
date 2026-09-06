'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/client/api';
import { Button, useToast } from './ui';
import { Icon } from './icons';

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setErr('');
    try {
      await api('/api/auth/login', { method: 'POST', json: { password } });
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
      router.refresh();
    } catch (e) {
      const m = errorMessage(e);
      setErr(m);
      toast.error('تعذر الدخول', m);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card card-lg scale-in" style={{ width: '100%', maxWidth: 400, margin: '0 auto', textAlign: 'right' }}>
      <div className="field">
        <label htmlFor="pw">كلمة المرور</label>
        <div className="input-row">
          <input id="pw" className="input input-lg" type={show ? 'text' : 'password'} autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" style={{ borderColor: err ? 'var(--danger)' : undefined }} />
          <button type="button" className="btn btn-icon" style={{ width: 52, height: 52 }} onClick={() => setShow((s) => !s)} title={show ? 'إخفاء' : 'إظهار'}>
            <Icon name="eye" size={18} />
          </button>
        </div>
        {err && <div className="subtle" style={{ color: 'var(--danger)' }}>{err}</div>}
      </div>
      <Button variant="primary" size="lg" block type="submit" disabled={!password} loading={busy} className="mt-2" icon="lock">
        دخول
      </Button>
    </form>
  );
}
