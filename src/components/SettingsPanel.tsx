'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { ErrorToast, SectionHeader, SuccessFlash, useFlash } from './ui';

interface Report { spec: boolean; rules: number; liked: number; disliked: number; saved: number; images: number; skipped: number }

export function SettingsPanel() {
  const router = useRouter();
  const [legacy, setLegacy] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useFlash(5000);

  async function importLegacy() {
    if (!legacy.trim() || busy) return;
    setBusy(true);
    setErr('');
    try {
      const parsed = JSON.parse(legacy);
      const { report: r } = await api<{ report: Report }>('/api/import', { method: 'POST', json: parsed });
      setReport(r);
      setLegacy('');
      setFlash('تم الاستيراد');
      router.refresh();
    } catch (e) {
      setErr(e instanceof SyntaxError ? 'النص ليس JSON صالحاً — انسخه كاملاً من localStorage' : errorMessage(e));
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
      setErr(errorMessage(e));
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
      <ErrorToast message={err} onClose={() => setErr('')} />
      <SuccessFlash message={flash} />

      <div className="train-section">
        <div className="card" style={{ padding: 22 }}>
          <SectionHeader icon="📥" color="cyan" title="استيراد ذاكرة النسخة القديمة" subtitle="افتح النسخة القديمة، ثم في console المتصفح نفّذ الأمر أدناه والصق الناتج هنا" />
          <div className="mono-block" style={{ marginBottom: 10 }}>copy(localStorage.getItem(&apos;basma-memory&apos;))</div>
          <textarea className="textarea-field" value={legacy} onChange={(e) => setLegacy(e.target.value)} placeholder='{"spec":"...","goldenRules":[...],...}' style={{ minHeight: 100, direction: 'ltr', textAlign: 'left', fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
          <div className="row end" style={{ marginTop: 10 }}>
            <button className="train-add-btn" disabled={!legacy.trim() || busy} onClick={importLegacy}>استيراد</button>
          </div>
          {report && (
            <div className="note" style={{ marginTop: 10 }}>
              تم: {report.rules} قاعدة، {report.liked} معجَب به، {report.disliked} مرفوض، {report.saved} محفوظ، {report.images} صورة{report.skipped ? `، تخطي ${report.skipped} مكرر` : ''}{report.spec ? '، والتخصص' : ''}
            </div>
          )}
        </div>
      </div>

      <div className="train-section">
        <div className="card" style={{ padding: 22 }}>
          <SectionHeader icon="🧨" color="red" title="إعادة تعيين كاملة" subtitle="يمسح كل الذاكرة والبوستات والصور والقواعد. لا رجعة فيه" />
          <div className="train-input-row">
            <input className="input-field" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="اكتب RESET للتأكيد" style={{ direction: 'ltr' }} />
            <button className="btn-small danger" disabled={confirm !== 'RESET' || busy} onClick={reset}>امسح كل شيء</button>
          </div>
        </div>
      </div>

      <div className="row end">
        <button className="btn-secondary" onClick={logout}>تسجيل الخروج</button>
      </div>
    </>
  );
}
