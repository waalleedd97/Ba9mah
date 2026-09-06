import { SettingsPanel } from '@/components/SettingsPanel';
import { usageLastDays } from '@/lib/db/repo';
import { getEnv } from '@/lib/env';
import { requireOnboarded } from '@/lib/guards';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  requireOnboarded();
  const env = getEnv();
  const usage = usageLastDays(30);
  const laborLabel = { auto: 'تلقائي (موارد بشرية أو مصطلحات قانونية)', always: 'دائماً', off: 'معطّل' }[env.LABOR_LAW_CHECK];
  return (
    <div className="page">
      <div className="container">
        <div className="page-head fade-in">
          <div className="emoji">⚙️</div>
          <h1>الإعدادات</h1>
          <p>النماذج والاستيراد وإعادة التعيين</p>
        </div>

        <div className="train-section">
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>🤖 النماذج (من ملف .env)</div>
            <table className="stats-table">
              <tbody>
                <tr><th>الكتابة والتعلم</th><td><span className="kbd">{env.CLAUDE_MODEL}</span></td></tr>
                <tr><th>الصور</th><td><span className="kbd">{env.GEMINI_IMAGE_MODEL}</span></td></tr>
                <tr><th>التحقق من نظام العمل</th><td>{laborLabel}</td></tr>
                <tr><th>مجلد البيانات</th><td><span className="kbd">{env.DATA_DIR}</span></td></tr>
                {env.mockAi && <tr><th>وضع الاختبار</th><td><span className="tag gold">BASMA_MOCK_AI مفعّل — لا اتصال بالنماذج</span></td></tr>}
              </tbody>
            </table>
            <div className="note" style={{ marginTop: 12 }}>
              آخر 30 يوم: {usage.calls} نداء · {usage.input.toLocaleString('en')} توكن إدخال ({usage.cached.toLocaleString('en')} من الكاش) · {usage.output.toLocaleString('en')} توكن إخراج{usage.failures ? ` · ${usage.failures} فشل` : ''}
            </div>
          </div>
        </div>

        <SettingsPanel />
      </div>
    </div>
  );
}
