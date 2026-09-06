'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { Button, useToast } from './ui';

export function RelearnButton({ disabled, label }: { disabled?: boolean; label: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      await api('/api/profile', { method: 'POST' });
      toast.success('تم تحديث ملف أسلوبك');
      router.refresh();
    } catch (e) {
      toast.error('تعذر التحديث', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="primary" onClick={run} disabled={disabled} loading={busy} icon="brain">
      {busy ? 'يحلل أسلوبك... قرابة دقيقة' : label}
    </Button>
  );
}
