import { RelearnButton } from '@/components/RelearnButton';
import { Confidence, Pill, SectionTitle, Stat } from '@/components/ui';
import { Icon } from '@/components/icons';
import { countImageRatings, latestProfile, listProfiles, listStyleStats, recentDislikeReasons } from '@/lib/db/repo';
import { isLearning, ratingsSinceProfile, MIN_NEW_RATINGS } from '@/lib/ai/learn';
import { IMAGE_STYLES } from '@/lib/images/styles';
import { requireOnboarded } from '@/lib/guards';
import { getAppStats } from '@/lib/stats';
import { formatDate } from '@/lib/text';

export const dynamic = 'force-dynamic';

function Block({ title, text, items }: { title: string; text?: string; items?: string[] }) {
return (
  <div className="card" style={{ padding: 18 }}>
    <div className="subtle mb-1" style={{ fontWeight: 700 }}>{title}</div>
    {text && <p style={{ fontSize: 14.5, lineHeight: 1.8 }}>{text}</p>}
    {items && (items.length ? <div className="row" style={{ gap: 6 }}>{items.map((i) => <Pill key={i} tone="violet">{i}</Pill>)}</div> : <span className="subtle">لا يوجد بعد</span>)}
  </div>
);
}


export default function ProfilePage() {
  requireOnboarded();
  const stats = getAppStats();
  const profile = latestProfile();
  const history = listProfiles(10);
  const since = ratingsSinceProfile();
  const learning = isLearning();
  const styleStats = listStyleStats();
  const imgRatings = countImageRatings();
  const reasons = recentDislikeReasons(6);
  const maxShown = Math.max(1, ...styleStats.map((s) => s.shown));


  return (
    <div className="page">
      <div className="page-head fade-up">
        <div>
          <div className="eyebrow">ملف الأسلوب</div>
          <h1>ما تعلّمه بصمة عنك</h1>
          <p>يُستخلص من جديد بعد كل {MIN_NEW_RATINGS} تقييمات، ويقود كل جولة قادمة</p>
        </div>
        {learning ? <Pill tone="violet" icon="brain">يحلل أسلوبك الآن</Pill> : <RelearnButton disabled={stats.liked < 3} label={profile ? 'أعد الاستخلاص الآن' : 'استخلص ملف أسلوبي'} />}
      </div>

      <div className="grid-4 mb-3 fade-up">
        <Stat icon="thumbs-up" tone="success" value={stats.liked} label="بوست أعجبك" />
        <Stat icon="thumbs-down" tone="danger" value={stats.disliked} label="بوست رفضته" />
        <Stat icon="brain" tone="violet" value={profile ? `v${profile.version}` : '—'} label={profile ? `الإصدار · ${profile.data.confidence === 'high' ? 'ثقة عالية' : profile.data.confidence === 'medium' ? 'ثقة متوسطة' : 'ثقة منخفضة'}` : 'لم يُستخلص بعد'} />
        <Stat icon="history" tone="info" value={since} label="تقييم منذ آخر ملف" />
      </div>

      {profile ? (
        <>
          <section className="card card-lg card-accent mb-2 fade-up">
            <div className="row between mb-2">
              <SectionTitle icon="brain" tone="violet">الملخص</SectionTitle>
              <Confidence level={profile.data.confidence} />
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.9 }}>{profile.data.summary}</p>
            <div className="subtle mt-2">آخر تحديث {formatDate(profile.createdAt)} · من {profile.likedCount} معجَب و{profile.dislikedCount} مرفوض</div>
          </section>
          <div className="grid-2 mb-2 fade-up">
            <Block title="النبرة والصوت" text={profile.data.voice} />
            <Block title="البنية" text={profile.data.structure} />
            <Block title="الطول" text={profile.data.length} />
            <Block title="التنسيق" text={profile.data.formatting} />
            <Block title="الافتتاحيات الناجحة" items={profile.data.hooks} />
            <Block title="حركات مميزة" items={profile.data.signature_moves} />
            <Block title="مفردات مميزة" items={profile.data.vocabulary} />
            <Block title="مواضيع تنجح" items={profile.data.topics_that_work} />
          </div>
          <div className="card mb-2 fade-up" style={{ padding: 18, borderColor: 'var(--danger-soft)' }}>
            <div className="subtle mb-1" style={{ fontWeight: 700, color: 'var(--danger)' }}>يتجنب</div>
            {profile.data.do_not.length ? <div className="row" style={{ gap: 6 }}>{profile.data.do_not.map((i) => <Pill key={i} tone="danger">{i}</Pill>)}</div> : <span className="subtle">لا يوجد بعد</span>}
          </div>
        </>
      ) : (
        <section className="card card-lg text-center mb-2 fade-up">
          <Icon name="brain" size={34} style={{ color: 'var(--violet)', marginBottom: 10 }} />
          <h3 style={{ marginBottom: 6 }}>لم يُستخلص ملفك بعد</h3>
          <p className="muted">قيّم بضعة بوستات، أو اضغط زر الاستخلاص أعلاه إذا كان عندك 3 بوستات معجَب بها على الأقل.</p>
        </section>
      )}

      <div className="grid-2 mb-2 fade-up">
        <section className="card">
          <SectionTitle icon="x" tone="danger">آخر أسباب الرفض المكتشفة</SectionTitle>
          {reasons.length ? (
            <div className="stack" style={{ gap: 8 }}>
              {reasons.map((r, i) => <div key={i} className="row nowrap" style={{ gap: 8, fontSize: 14 }}><span className="dot" style={{ color: 'var(--danger)' }} /> {r}</div>)}
            </div>
          ) : <span className="subtle">لا رفض بعد</span>}
        </section>
        <section className="card">
          <SectionTitle icon="palette" tone="violet">ذكاء الصور</SectionTitle>
          <div className="row mb-2" style={{ gap: 6 }}>
            <Pill tone="success" icon="thumbs-up">{imgRatings.liked} صورة</Pill>
            <Pill tone="danger" icon="thumbs-down">{imgRatings.disliked} صورة</Pill>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {IMAGE_STYLES.map((s) => {
              const st = styleStats.find((x) => x.styleKey === s.key);
              return (
                <div key={s.key}>
                  <div className="row between subtle" style={{ marginBottom: 4 }}>
                    <span>{s.label}</span>
                    <span>عُرض {st?.shown ?? 0} · اخترته {st?.selected ?? 0} · 👍 {st?.liked ?? 0}</span>
                  </div>
                  <div className="bar"><span style={{ width: `${((st?.selected ?? 0) / maxShown) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {history.length > 1 && (
        <section className="card fade-up">
          <SectionTitle icon="history" tone="info">الإصدارات السابقة</SectionTitle>
          <div className="timeline">
            {history.slice(1).map((h) => (
              <div key={h.id} className="timeline-item"><b>v{h.version}</b> · {formatDate(h.createdAt)} · {h.data.summary.slice(0, 100)}…</div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
