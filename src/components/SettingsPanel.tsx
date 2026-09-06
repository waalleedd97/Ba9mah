'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { Button, SectionTitle, useToast } from './ui';

interface Report { spec: boolean; rules: number; liked: number; disliked: number; saved: number; images: number; skipped: number }

export function SettingsPanel() {
  const router = useRouter();
  const toast = useToast();
  const [legacy, setLegacy] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function importLegacy() {
    if (!legacy.trim() || busy) return;
    setBusy(true);
    try {
      const parsed = JSON.parse(legacy);
      const { report: r } = await api<{ report: Report }>('/api/import', { method: 'POST', json: parsed });
      setReport(r);
      setLegacy('');
      toast.success('تم الاستيراد');
      router.refresh();
    } catch (e) {
      toast.error('تعذر الاستيراد', e instanceof SyntaxError ? 'النص ليس JSON صالحاً، انسخه كاملاً من localStorage' : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (confirm !== 'RESET' || busy) return;
    setBusy(true);
    try {
      await api('/api/reset', { method: 'POST', json: { confirm: 'RESET' } });
      router.push('/onboarding');
      router.refresh();
    } catch (e) {
      toast.error('تعذرت إعادة التعيين', errorMessage(e));
      setBusy(false);
    }
  }
  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <section className="card mb-2 fade-up">
        <SectionTitle icon="download" tone="info">استيراد ذاكرة النسخة القديمة</SectionTitle>
        <p className="subtle mb-1">في النسخة القديمة افتح console المتصفح ونفّذ الأمر التالي، ثم الصق الناتج هنا:</p>
        <div className="mono-block mb-2">copy(localStorage.getItem(&apos;basma-memory&apos;))</div>
        <textarea className="textarea" value={legacy} onChange={(e) => setLegacy(e.target.value)} placeholder='{"spec":"...","goldenRules":[...],...}' style={{ minHeight: 90, direction: 'ltr', textAlign: 'left', fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
        <div className="row between mt-2">
          {report ? (
            <span className="subtle">
              {report.rules} قاعدة · {report.liked} معجَب · {report.disliked} مرفوض · {report.saved} محفوظ · {report.images} صورة{report.skipped ? ` · تخطي ${report.skipped} مكرر` : ''}
            </span>
          ) : <span />}
          <Button onClick={importLegacy} disabled={!legacy.trim()} loading={busy} icon="upload">استيراد</Button>
        </div>
      </section>

      <section className="card mb-2 fade-up" style={{ borderColor: 'var(--danger-soft)' }}>
        <SectionTitle icon="alert" tone="danger">إعادة تعيين كاملة</SectionTitle>
        <p className="subtle mb-2">يمسح كل الذاكرة والبوستات والصور والقواعد. لا رجعة فيه.</p>
        <div className="input-row">
          <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="اكتب RESET للتأكيد" style={{ direction: 'ltr' }} />
          <Button variant="danger" onClick={reset} disabled={confirm !== 'RESET'} loading={busy} icon="trash">امسح كل شيء</Button>
        </div>
      </section>

      <div className="row end">
        <Button variant="ghost" onClick={logout} icon="log-out">تسجيل الخروج</Button>
      </div>
    </>
  );
}
