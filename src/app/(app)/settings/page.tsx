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
          <b style={{ color: 'var(--warn)' }}>وضع الاختبار مفعّل: البوستات والصور وهمية</b>
          <p className="subtle" style={{ marginTop: 6 }}>مفتاح Gemini غير مضبوط بعد. أنشئ مفتاحاً من aistudio.google.com/apikey ثم نفّذ هذا الأمر على السيرفر عبر SSH (يحافظ على بياناتك):</p>
          <code className="kbd" style={{ display: 'block', direction: 'ltr', textAlign: 'left', whiteSpace: 'pre-wrap', padding: '10px 12px', marginTop: 8 }}>
            sudo bash /opt/basma/scripts/deploy-hetzner.sh --gemini-key المفتاح
          </code>
          <p className="subtle" style={{ marginTop: 8 }}>الكتابة والتعلم يعملان على الحصة المجانية. توليد الصور يتطلب تفعيل الفوترة في مشروع Google المرتبط بالمفتاح.</p>
        </div>
      )}

      <section className="card mb-2 fade-up">
        <SectionTitle icon="cpu" tone="info">النماذج</SectionTitle>
        <table className="stats-table">
          <tbody>
            <tr><th>الكتابة والتعلم</th><td><span className="kbd">{env.GEMINI_TEXT_MODEL}</span>{env.GEMINI_TEXT_FALLBACKS ? <span className="subtle"> · بدائل: {env.GEMINI_TEXT_FALLBACKS.split(',').join('، ')}</span> : null}</td><td>{keyOk(env.GEMINI_API_KEY) ? <Pill tone="success">مفتاح مضبوط</Pill> : <Pill tone="warn">بدون مفتاح</Pill>}</td></tr>
            <tr><th>الصور</th><td><span className="kbd">{env.GEMINI_IMAGE_MODEL}</span><span className="subtle"> · يتطلب فوترة مفعّلة في مشروع Google</span></td><td>{keyOk(env.GEMINI_API_KEY) ? <Pill tone="success">مفتاح مضبوط</Pill> : <Pill tone="warn">بدون مفتاح</Pill>}</td></tr>
            <tr><th>التحقق من نظام العمل</th><td colSpan={2}>{laborLabel}</td></tr>
            <tr><th>مجلد البيانات</th><td colSpan={2}><span className="kbd">{env.DATA_DIR}</span></td></tr>
            <tr><th>إصدار التطبيق</th><td colSpan={2}><span className="kbd">{env.BASMA_BUILD_SHA}</span>{env.BASMA_BUILD_DATE ? <span className="subtle"> · بُني {env.BASMA_BUILD_DATE}</span> : null}</td></tr>
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
