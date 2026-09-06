import { SettingsPanel } from '@/components/SettingsPanel';
import { Pill, SectionTitle } from '@/components/ui';
import { usageLastDays } from '@/lib/db/repo';
import { getEnv } from '@/lib/env';
import { requireOnboarded } from '@/lib/guards';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  requireOnboarded();
  const env = getEnv();
  const usage = usageLastDays(30);
  const laborLabel = { auto: 'تلقائي: للموارد البشرية أو عند ظهور مصطلحات قانونية', always: 'دائماً', off: 'معطّل' }[env.LABOR_LAW_CHECK];
  const keyOk = (k?: string) => Boolean(k && !/xxxxx|\.\.\./.test(k) && k.length > 20);
  return (
    <div className="page page-narrow">
      <div className="page-head fade-up">
        <div>
          <div className="eyebrow">الإعدادات</div>
          <h1>النماذج والبيانات</h1>
          <p>القيم تُضبط من ملف .env على السيرفر</p>
        </div>
      </div>

      {env.mockAi && (
        <div className="card mb-2 fade-up" style={{ borderColor: 'var(--warn)' }}>
          <b style={{ color: 'var(--warn)' }}>وضع الاختبار مفعّل</b>
          <p className="subtle">البوستات والصور وهمية لأن مفاتيح Anthropic و Gemini غير مضبوطة بعد. أضفها ثم أعد تشغيل سكربت النشر.</p>
        </div>
      )}

      <section className="card mb-2 fade-up">
        <SectionTitle icon="cpu" tone="info">النماذج</SectionTitle>
        <table className="stats-table">
          <tbody>
            <tr><th>الكتابة والتعلم</th><td><span className="kbd">{env.CLAUDE_MODEL}</span></td><td>{keyOk(env.ANTHROPIC_API_KEY) ? <Pill tone="success">مفتاح مضبوط</Pill> : <Pill tone="warn">بدون مفتاح</Pill>}</td></tr>
            <tr><th>الصور</th><td><span className="kbd">{env.GEMINI_IMAGE_MODEL}</span></td><td>{keyOk(env.GEMINI_API_KEY) ? <Pill tone="success">مفتاح مضبوط</Pill> : <Pill tone="warn">بدون مفتاح</Pill>}</td></tr>
            <tr><th>التحقق من نظام العمل</th><td colSpan={2}>{laborLabel}</td></tr>
            <tr><th>مجلد البيانات</th><td colSpan={2}><span className="kbd">{env.DATA_DIR}</span></td></tr>
          </tbody>
        </table>
        <p className="subtle mt-2">
          آخر 30 يوماً: {usage.calls} نداء · {usage.input.toLocaleString('en')} توكن إدخال ({usage.cached.toLocaleString('en')} من الكاش) · {usage.output.toLocaleString('en')} توكن إخراج{usage.failures ? ` · ${usage.failures} فشل` : ''}
        </p>
      </section>

      <SettingsPanel />
    </div>
  );
}
