'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AppStats, Round, StyleProfile } from '@/lib/types';
import type { RoundSummary } from '@/lib/db/repo/rounds';
import { api, errorMessage, fileToDataUrl } from '@/lib/client/api';
import { formatDate } from '@/lib/text';
import { Button, Confidence, GenerationLoader, Pill, SectionTitle, Stat, useToast } from './ui';
import { Icon } from './icons';

interface Props {
  stats: AppStats;
  profile: StyleProfile | null;
  goldenRules: string[];
  currentRound: Round | null;
  recent: RoundSummary[];
  suggestions: string[];
  learning: boolean;
}

export function Dashboard({ stats, profile, goldenRules, currentRound, recent, suggestions, learning }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<'topic' | 'news'>('topic');
  const [topic, setTopic] = useState('');
  const [newsText, setNewsText] = useState('');
  const [newsImage, setNewsImage] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (busy) return;
    if (mode === 'news' && !newsText.trim() && !newsImage) {
      toast.error('أعطني الخبر أولاً', 'الصق نصه أو رابطه، أو ارفع صورته');
      return;
    }
    setBusy(true);
    try {
      const json = mode === 'news' ? { news: { text: newsText.trim() || undefined, image: newsImage ?? undefined } } : { topic: topic.trim() || undefined };
      const { round } = await api<{ round: Round }>('/api/rounds', { method: 'POST', json });
      router.push(`/round/${round.id}`);
    } catch (e) {
      toast.error('تعذر توليد الجولة', errorMessage(e));
      setBusy(false);
    }
  }

  async function pickImage(file?: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return toast.error('الصورة أكبر من 8 ميغابايت');
    if (!file.type.startsWith('image/')) return toast.error('الملف ليس صورة');
    setNewsImage(await fileToDataUrl(file));
  }

  if (busy) {
    if (mode === 'news') return <GenerationLoader title="يقرأ الخبر ويتأكد من حقائقه ثم يكتب" subtitle={newsText.trim() ? newsText.trim().slice(0, 80) : 'يقرأ الخبر من الصورة'} />;
    return <GenerationLoader title={stats.rounds > 0 ? 'يكتب بوستات أقرب لذوقك' : 'يكتب أول بوستاتك'} subtitle={topic.trim() ? `الموضوع: ${topic.trim()}` : `${stats.liked} مثال ناجح · ${stats.goldenRules} قاعدة ذهبية${profile ? ` · ملف الأسلوب v${profile.version}` : ''}`} />;
  }

  const committed = 4 - stats.exploratoryNext;

  return (
    <div className="page">
      <div className="page-head fade-up">
        <div>
          <div className="eyebrow">مرحباً بعودتك</div>
          <h1>وش نكتب اليوم؟</h1>
          <p>{stats.spec}</p>
        </div>
        {learning ? (
          <Pill tone="violet" icon="brain">يحدّث ملف أسلوبك الآن</Pill>
        ) : profile ? (
          <Link href="/profile">
            <Pill tone="violet" icon="brain">ملف الأسلوب v{profile.version}</Pill>
          </Link>
        ) : null}
      </div>

      {currentRound?.status === 'rating' && (
        <div className="card mb-2 fade-up row between" style={{ borderColor: 'var(--info)' }}>
          <div className="row" style={{ gap: 12 }}>
            <span className="icon-bubble info" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center' }}>
              <Icon name="layers" size={18} />
            </span>
            <div>
              <b>عندك جولة ما اكتمل تقييمها</b>
              <div className="subtle">الجولة {currentRound.id}{currentRound.topic ? ` · ${currentRound.topic}` : ''}</div>
            </div>
          </div>
          <Link href={`/round/${currentRound.id}`} className="btn btn-primary btn-sm">
            أكمل التقييم <Icon name="arrow-left" size={16} />
          </Link>
        </div>
      )}

      <section className="card card-lg card-accent mb-2 fade-up">
        <SectionTitle icon="sparkles">جولة جديدة</SectionTitle>
        <div className="tabs mb-2" style={{ maxWidth: 360 }}>
          <button type="button" className={`tab ${mode === 'topic' ? 'active' : ''}`} onClick={() => setMode('topic')}><Icon name="target" size={15} /> موضوع</button>
          <button type="button" className={`tab ${mode === 'news' ? 'active' : ''}`} onClick={() => setMode('news')}><Icon name="globe" size={15} /> خبر</button>
        </div>

        {mode === 'topic' ? (
          <>
            <input className="input input-lg" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="موضوع معيّن؟ اتركه فاضياً وبصمة يختار مواضيع جديدة" onKeyDown={(e) => e.key === 'Enter' && generate()} maxLength={200} />
            <div className="row mt-2" style={{ gap: 8 }}>
              {suggestions.map((s) => (
                <button key={s} type="button" className={`chip ${topic === s ? 'active' : ''}`} onClick={() => setTopic(topic === s ? '' : s)}>
                  {s}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <textarea className="textarea" value={newsText} onChange={(e) => setNewsText(e.target.value)} placeholder="الصق الخبر أو عنوانه أو رابطه. بصمة يقرأ الرابط ويبحث عن الخبر ثم يكتب 4 بوستات عنه بأسلوبك" style={{ minHeight: 96 }} maxLength={6000} />
            {!newsImage ? (
              <div
                className={`upload-area mt-2 ${drag ? 'drag' : ''}`}
                style={{ padding: 14 }}
                onClick={() => document.getElementById('news-file')?.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); pickImage(e.dataTransfer.files?.[0]); }}
              >
                <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
                  <Icon name="image" size={18} />
                  <span><b>صورة الخبر</b> (اختياري): اسحبها هنا أو اضغط للاختيار</span>
                </div>
              </div>
            ) : (
              <div className="upload-preview mt-2" style={{ maxHeight: 220 }}>
                <img src={newsImage} alt="صورة الخبر" style={{ maxHeight: 220, objectFit: 'contain' }} />
                <button type="button" className="overlay-btn" style={{ position: 'absolute', top: 10, insetInlineEnd: 10 }} onClick={() => setNewsImage(null)} title="إزالة">
                  <Icon name="x" size={16} />
                </button>
              </div>
            )}
            <input id="news-file" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pickImage(e.target.files?.[0])} />
          </>
        )}

        <div className="row between mt-3">
          <span className="subtle row" style={{ gap: 6 }}>
            {mode === 'news' ? (
              <>
                <Icon name="globe" size={14} /> يقرأ الروابط ويبحث في الويب ثم يكتب بزوايا مختلفة
              </>
            ) : (
              <>
                <Icon name="target" size={14} /> {committed} ملتزم بأسلوبك
                <span style={{ opacity: 0.5 }}>·</span>
                <Icon name="flask" size={14} /> {stats.exploratoryNext} استكشافي
              </>
            )}
          </span>
          <Button variant="primary" size="lg" onClick={generate} icon={mode === 'news' ? 'globe' : 'sparkles'}>
            {mode === 'news' ? 'ابحث واكتب 4 بوستات' : 'ولّد 4 بوستات'}
          </Button>
        </div>
      </section>

      <div className="grid-4 mb-2 fade-up">
        <Stat icon="thumbs-up" tone="success" value={stats.liked} label="بوست أعجبك" />
        <Stat icon="thumbs-down" tone="danger" value={stats.disliked} label="بوست رفضته" />
        <Stat icon="layers" tone="info" value={stats.rounds} label="جولة" />
        <Stat icon="bookmark" tone="warn" value={stats.saved} label="محفوظ" />
      </div>

      <div className="grid-2 mb-2 fade-up">
        <section className="card">
          <SectionTitle icon="brain" tone="violet" action={<Link href="/profile" className="subtle">التفاصيل</Link>}>
            ملف أسلوبك
          </SectionTitle>
          {profile ? (
            <>
              <p style={{ lineHeight: 1.8, fontSize: 14 }}>{profile.data.summary}</p>
              <div className="row mt-2" style={{ gap: 6 }}>
                {profile.data.hooks.slice(0, 3).map((h) => (
                  <Pill key={h} tone="violet">{h}</Pill>
                ))}
              </div>
              <div className="row between mt-2 subtle">
                <span>الإصدار {profile.version}</span>
                <Confidence level={profile.data.confidence} />
              </div>
            </>
          ) : (
            <p className="muted" style={{ fontSize: 14 }}>
              يُستخلص تلقائياً بعد أول {Math.max(3 - stats.ratingsSinceProfile, 1)} تقييمات. قيّم جولة وستراه هنا.
            </p>
          )}
        </section>
        <section className="card">
          <SectionTitle icon="zap" action={<Link href="/train" className="subtle">تعديل</Link>}>
            القواعد الذهبية
          </SectionTitle>
          {goldenRules.length ? (
            <div className="stack" style={{ gap: 8 }}>
              {goldenRules.slice(0, 4).map((r) => (
                <div key={r} className="row nowrap" style={{ gap: 8, fontSize: 14 }}>
                  <Icon name="check" size={15} style={{ color: 'var(--success)' }} />
                  <span>{r}</span>
                </div>
              ))}
              {goldenRules.length > 4 && <span className="subtle">+{goldenRules.length - 4} أخرى</span>}
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 14 }}>أضف قواعد ثابتة يلتزم بها كل بوست من صفحة التدريب.</p>
          )}
        </section>
      </div>

      {recent.length > 0 && (
        <section className="card fade-up">
          <SectionTitle icon="history" tone="info">آخر الجولات</SectionTitle>
          <div className="list">
            {recent.map((r) => (
              <Link key={r.id} href={`/round/${r.id}`} className="list-item">
                <span className="grow">
                  <b>{r.topic || `الجولة ${r.id}`}</b>
                  <div className="subtle">{formatDate(r.createdAt)}</div>
                </span>
                <span className="row" style={{ gap: 6 }}>
                  {r.status === 'rating' && <Pill tone="info">قيد التقييم</Pill>}
                  <Pill tone="success" icon="thumbs-up">{r.liked}</Pill>
                  <Pill tone="danger" icon="thumbs-down">{r.disliked}</Pill>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
