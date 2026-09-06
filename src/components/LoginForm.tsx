'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/client/api';
import { ErrorToast } from './ui';

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
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
      setErr(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card login-card fade-in" style={{ padding: 28 }}>
      <label className="note" htmlFor="pw" style={{ display: 'block', marginBottom: 8, fontWeight: 700 }}>كلمة المرور</label>
      <input id="pw" className="input-field" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      <div style={{ marginTop: 14 }}>
        <ErrorToast message={err} onClose={() => setErr('')} />
      </div>
      <button className="btn-primary" type="submit" disabled={!password || busy} style={{ width: '100%' }}>
        {busy ? 'جارٍ الدخول...' : 'دخول'}
      </button>
    </form>
  );
}
