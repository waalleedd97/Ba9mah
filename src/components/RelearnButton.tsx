'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { ErrorToast } from './ui';

export function RelearnButton({ disabled, label }: { disabled?: boolean; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function run() {
    setBusy(true);
    setErr('');
    try {
      await api('/api/profile', { method: 'POST' });
      router.refresh();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <ErrorToast message={err} onClose={() => setErr('')} />
      <button className="btn-primary" onClick={run} disabled={busy || disabled}>{busy ? '🧠 يحلل أسلوبك... (قرابة دقيقة)' : label}</button>
    </div>
  );
}
