import { RelearnButton } from '@/components/RelearnButton';
import { countImageRatings, latestProfile, listProfiles, listStyleStats, recentDislikeReasons } from '@/lib/db/repo';
import { isLearning, ratingsSinceProfile, MIN_NEW_RATINGS } from '@/lib/ai/learn';
import { IMAGE_STYLES } from '@/lib/images/styles';
import { requireOnboarded } from '@/lib/guards';
import { getAppStats } from '@/lib/stats';
import { formatDate } from '@/lib/text';

export const dynamic = 'force-dynamic';

const CONF: Record<string, string> = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية' };

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

  const list = (items: string[]) => (items.length ? <ul>{items.map((i, k) => <li key={k}>{i}</li>)}</ul> : <p className="note">لا يوجد بعد</p>);

  return (
    <div className="page">
      <div className="container">
        <div className="page-head fade-in">
          <div className="emoji">🧬</div>
          <h1>ملف أسلوبك</h1>
          <p>ما تعلّمه بصمة عنك من كل تقييم — يُستخلص من جديد بعد كل {MIN_NEW_RATINGS} تقييمات</p>
        </div>

        <div className="grid-2 fade-in-up" style={{ marginBottom: 20 }}>
          <div className="stat-box green-bg"><div style={{ fontSize: 26, fontWeight: 900, color: 'var(--green)' }}>{stats.liked}</div><div className="note">بوست أعجبك</div></div>
          <div className="stat-box red-bg"><div style={{ fontSize: 26, fontWeight: 900, color: 'var(--red)' }}>{stats.disliked}</div><div className="note">بوست رفضته</div></div>
          <div className="stat-box purple-bg"><div style={{ fontSize: 26, fontWeight: 900, color: 'var(--purple)' }}>{profile ? `v${profile.version}` : '—'}</div><div className="note">إصدار الملف · ثقة {profile ? CONF[profile.data.confidence] : '—'}</div></div>
          <div className="stat-box cyan-bg"><div style={{ fontSize: 26, fontWeight: 900, color: 'var(--cyan)' }}>{since}</div><div className="note">تقييم جديد منذ آخر ملف</div></div>
        </div>

        <div className="card" style={{ padding: 22, marginBottom: 16 }}>
          {learning && <div className="success-flash" style={{ marginBottom: 12 }}>🧠 بصمة يحلل أسلوبك الآن...</div>}
          {profile ? (
            <>
              <div className="row between" style={{ marginBottom: 14 }}>
                <div className="note">آخر تحديث: {formatDate(profile.createdAt)} · من {profile.likedCount} معجَب و{profile.dislikedCount} مرفوض</div>
              </div>
              <div className="profile-section"><h3>الملخص</h3><p>{profile.data.summary}</p></div>
              <div className="profile-section"><h3>النبرة والصوت</h3><p>{profile.data.voice}</p></div>
              <div className="profile-section"><h3>البنية</h3><p>{profile.data.structure}</p></div>
              <div className="profile-section"><h3>الطول</h3><p>{profile.data.length}</p></div>
              <div className="profile-section"><h3>الافتتاحيات الناجحة</h3>{list(profile.data.hooks)}</div>
              <div className="profile-section"><h3>التنسيق</h3><p>{profile.data.formatting}</p></div>
              <div className="profile-section"><h3>مفردات مميزة</h3>{list(profile.data.vocabulary)}</div>
              <div className="profile-section"><h3>حركات مميزة</h3>{list(profile.data.signature_moves)}</div>
              <div className="profile-section"><h3>تجنب</h3>{list(profile.data.do_not)}</div>
              <div className="profile-section"><h3>مواضيع تنجح</h3>{list(profile.data.topics_that_work)}</div>
            </>
          ) : (
            <p className="note" style={{ marginBottom: 14 }}>لم يُستخلص ملف بعد. قيّم بضعة بوستات أو اضغط الزر أدناه.</p>
          )}
          <div style={{ marginTop: 14 }}>
            <RelearnButton disabled={learning || stats.liked < 3} label={profile ? '🧠 أعد استخلاص الملف الآن' : '🧠 استخلص ملف أسلوبي'} />
          </div>
        </div>

        {reasons.length > 0 && (
          <div className="section-panel red-panel fade-in-up" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--red)', marginBottom: 10 }}>✕ آخر أسباب الرفض المكتشفة</div>
            {reasons.map((r, i) => <div key={i} style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>● {r}</div>)}
          </div>
        )}

        <div className="section-panel purple-panel fade-in-up" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--purple)', marginBottom: 10 }}>🎨 ذكاء الصور</div>
          <div className="row" style={{ marginBottom: 10 }}>
            <span className="tag green" style={{ fontSize: 12 }}>🎨 {imgRatings.liked} صورة أعجبتك</span>
            <span className="tag red" style={{ fontSize: 12 }}>🎨 {imgRatings.disliked} صورة رفضتها</span>
          </div>
          <table className="stats-table">
            <thead><tr><th>النمط</th><th>عُرض</th><th>اخترته</th><th>👍</th><th>👎</th></tr></thead>
            <tbody>
              {IMAGE_STYLES.map((s) => {
                const st = styleStats.find((x) => x.styleKey === s.key);
                return <tr key={s.key}><td>{s.label}</td><td>{st?.shown ?? 0}</td><td>{st?.selected ?? 0}</td><td>{st?.liked ?? 0}</td><td>{st?.disliked ?? 0}</td></tr>;
              })}
            </tbody>
          </table>
        </div>

        {history.length > 1 && (
          <div className="section-panel cyan-panel fade-in-up">
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--cyan)', marginBottom: 10 }}>🕰 الإصدارات السابقة</div>
            {history.slice(1).map((h) => (
              <div key={h.id} className="note" style={{ marginBottom: 6 }}>v{h.version} · {formatDate(h.createdAt)} · {h.data.summary.slice(0, 90)}…</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
