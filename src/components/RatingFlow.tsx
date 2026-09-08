'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AppStats, ImageRecord, PostWithImages, Round } from '@/lib/types';
import { api, errorMessage } from '@/lib/client/api';
import { DISLIKE_REASON_OPTIONS } from '@/lib/seed';
import { ImageGrid } from './ImageGrid';
import { Button, GenerationLoader, IconButton, Pill, PostPreview, Stat, Stepper, useToast } from './ui';
import { Icon } from './icons';

interface Props {
  round: Round;
  initialPosts: PostWithImages[];
  stats: AppStats;
}

export function RatingFlow({ round, initialPosts, stats }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [posts, setPosts] = useState(initialPosts);
  const firstUnrated = initialPosts.findIndex((p) => p.rating === null);
  const [idx, setIdx] = useState(firstUnrated === -1 ? 0 : firstUnrated);
  const [done, setDone] = useState(firstUnrated === -1 && initialPosts.length > 0);
  const [leaving, setLeaving] = useState<'' | 'left' | 'right'>('');
  const [manual, setManual] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [imgOpen, setImgOpen] = useState(() => Boolean(initialPosts[firstUnrated === -1 ? 0 : firstUnrated]?.selectedImageId || initialPosts[firstUnrated === -1 ? 0 : firstUnrated]?.images.length));
  const [saveBusy, setSaveBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [askReason, setAskReason] = useState(false);
  const [reasonKeys, setReasonKeys] = useState<string[]>([]);
  const [otherReason, setOtherReason] = useState('');
  const [newsOpen, setNewsOpen] = useState(false);

  const cur = posts[idx];
  const newLikes = posts.filter((p, i) => p.rating === 'liked' && initialPosts[i]?.rating !== 'liked').length;
  const newDislikes = posts.filter((p, i) => p.rating === 'disliked' && initialPosts[i]?.rating !== 'disliked').length;
  const liked = stats.liked + newLikes;
  const disliked = stats.disliked + newDislikes;

  function patch(id: string, data: Partial<PostWithImages>) {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
  }

  function goTo(i: number) {
    if (i < 0 || i >= posts.length) return;
    setIdx(i);
    setAskReason(false);
    setReasonKeys([]);
    setOtherReason('');
    setManual(null);
    setAiOpen(false);
    setAiText('');
    setImgOpen(Boolean(posts[i]?.selectedImageId || posts[i]?.images.length));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function rate(likedIt: boolean, reasons: string[] = []) {
    if (!cur) return;
    setAskReason(false);
    setReasonKeys([]);
    setOtherReason('');
    try {
      const { post } = await api<{ post: PostWithImages }>(`/api/posts/${cur.id}/rate`, { method: 'POST', json: { liked: likedIt, reasons } });
      const updated = posts.map((p) => (p.id === cur.id ? { ...p, rating: post.rating, ratedAt: post.ratedAt } : p));
      setPosts(updated);
      toast.success(likedIt ? 'أعجبك — بصمة يتعلم من هذا الأسلوب' : reasons.length ? `رفضته: ${reasons.join('، ')} — سيتجنبها` : 'رفضته — يحلل السبب في الخلفية');
      const nextUnrated = updated.findIndex((p, i) => p.rating === null && i !== idx);
      setLeaving(likedIt ? 'right' : 'left');
      setTimeout(() => {
        setLeaving('');
        if (nextUnrated === -1) setDone(true);
        else goTo(nextUnrated);
      }, 320);
    } catch (e) {
      toast.error('تعذر حفظ التقييم', errorMessage(e));
    }
  }

  /** يجمع الشرائح المختارة والسبب المكتوب في قائمة أسباب واحدة */
  function submitDislike() {
    const picked = DISLIKE_REASON_OPTIONS.filter((o) => reasonKeys.includes(o.key)).map((o) => o.reason);
    const extra = otherReason.trim() ? [otherReason.trim()] : [];
    rate(false, [...picked, ...extra]);
  }

  async function saveManual() {
    if (!cur || manual === null || !manual.trim()) return;
    try {
      const { post } = await api<{ post: PostWithImages }>(`/api/posts/${cur.id}`, { method: 'PATCH', json: { content: manual } });
      patch(cur.id, { content: post.content, originalContent: post.originalContent });
      setManual(null);
      toast.success('حُفظ تعديلك', 'الفرق بين النسختين إشارة قوية لذوقك');
    } catch (e) {
      toast.error('تعذر الحفظ', errorMessage(e));
    }
  }

  async function aiEdit() {
    if (!cur || !aiText.trim() || aiBusy) return;
    setAiBusy(true);
    try {
      const { post, summary } = await api<{ post: PostWithImages; summary: string }>(`/api/posts/${cur.id}/edit`, { method: 'POST', json: { instruction: aiText } });
      patch(cur.id, { content: post.content, originalContent: post.originalContent });
      setAiText('');
      setAiOpen(false);
      toast.success('تم التعديل', summary);
    } catch (e) {
      toast.error('تعذر التعديل', errorMessage(e));
    } finally {
      setAiBusy(false);
    }
  }

  async function toggleSave(p: PostWithImages) {
    if (saveBusy) return;
    setSaveBusy(true);
    try {
      if (p.savedId) {
        await api(`/api/saved/${p.savedId}`, { method: 'DELETE' });
        patch(p.id, { savedId: null });
        toast.info('أُزيل من المحفوظات');
      } else {
        const { saved } = await api<{ saved: { id: string } }>('/api/saved', { method: 'POST', json: { postId: p.id } });
        patch(p.id, { savedId: saved.id });
        toast.success('حُفظ البوست', 'تجده في المحفوظات مع صورته');
      }
    } catch (e) {
      toast.error('تعذر الحفظ', errorMessage(e));
    } finally {
      setSaveBusy(false);
    }
  }

  async function copyText(t: string) {
    await navigator.clipboard.writeText(t);
    toast.success('تم النسخ');
  }

  async function newRound() {
    setGenerating(true);
    try {
      const { round: r } = await api<{ round: Round }>('/api/rounds', { method: 'POST', json: {} });
      router.push(`/round/${r.id}`);
    } catch (e) {
      toast.error('تعذر التوليد', errorMessage(e));
      setGenerating(false);
    }
  }

  if (generating) return <GenerationLoader title="يكتب بوستات أقرب لذوقك" subtitle={`${liked} مثال ناجح وملف أسلوبك الحالي`} />;

  // ===================== ملخص الجولة =====================
  if (done) {
    const rl = posts.filter((p) => p.rating === 'liked').length;
    const rd = posts.filter((p) => p.rating === 'disliked').length;
    return (
      <div className="page page-narrow">
        <div className="card card-lg card-accent text-center mb-2 scale-in">
          <div className="icon-bubble success" style={{ width: 64, height: 64, borderRadius: 20, margin: '0 auto 14px', display: 'grid', placeItems: 'center' }}>
            <Icon name="check" size={30} strokeWidth={2.5} />
          </div>
          <div className="eyebrow mb-1">الجولة {round.id}</div>
          <h1 style={{ fontSize: 26, marginBottom: 6 }}>اكتملت الجولة</h1>
          <p className="muted">{stats.ratingsSinceProfile + rl + rd >= 3 ? 'بصمة يحدّث ملف أسلوبك في الخلفية الآن' : 'كل تقييم يُحلَّل ويحسّن الجولة القادمة'}</p>
          <div className="grid-3 mt-3" style={{ textAlign: 'right' }}>
            <Stat icon="thumbs-up" tone="success" value={rl} label="أعجبك" />
            <Stat icon="thumbs-down" tone="danger" value={rd} label="رفضته" />
            <Stat icon="bookmark" tone="warn" value={posts.filter((p) => p.savedId).length} label="حفظته" />
          </div>
        </div>
        <div className="stack mb-3">
          {posts.map((p, i) => (
            <div key={p.id} className="list-item fade-up" style={{ animationDelay: `${i * 0.05}s`, alignItems: 'center' }}>
              <span className={`icon-bubble ${p.rating === 'liked' ? 'success' : 'danger'}`} style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', flex: 'none' }}>
                <Icon name={p.rating === 'liked' ? 'thumbs-up' : 'thumbs-down'} size={16} />
              </span>
              <span className="grow">
                <b>{p.topic}</b>
                <div className="subtle" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.content.split('\n')[0]}</div>
              </span>
              <span className="row nowrap" style={{ gap: 4 }}>
                <IconButton icon="eye" label="عرض" size="sm" onClick={() => { setDone(false); goTo(i); }} />
                <IconButton icon="copy" label="نسخ" size="sm" onClick={() => copyText(p.content)} />
                <IconButton icon={p.savedId ? 'bookmark-check' : 'bookmark'} label={p.savedId ? 'محفوظ' : 'احفظ'} size="sm" onClick={() => toggleSave(p)} className={p.savedId ? 'btn-success' : ''} />
              </span>
            </div>
          ))}
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Button variant="primary" size="lg" onClick={newRound} icon="sparkles" style={{ flex: 1 }}>
            جولة جديدة أقرب لذوقك
          </Button>
          <Link href="/" className="btn btn-lg">الرئيسية</Link>
        </div>
      </div>
    );
  }

  if (!cur) return null;

  // ===================== تقييم بوست =====================
  return (
    <div className="page page-narrow has-ratebar">
      <div className="page-head">
        <div>
          <div className="eyebrow">الجولة {round.id}</div>
          <h1 style={{ fontSize: 24 }}>{round.topic ?? 'قيّم البوستات'}</h1>
        </div>
        <div className="row nowrap" style={{ gap: 6 }}>
          <Pill tone="success" icon="thumbs-up">{liked}</Pill>
          <Pill tone="danger" icon="thumbs-down">{disliked}</Pill>
        </div>
      </div>

      {round.news && (
        <div className="card mb-2 fade-up" style={{ padding: 14, borderColor: 'var(--info)' }}>
          <button type="button" className="row between" style={{ width: '100%', background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', textAlign: 'start' }} onClick={() => setNewsOpen((o) => !o)}>
            <span className="row" style={{ gap: 8 }}>
              <Icon name="globe" size={16} style={{ color: 'var(--info)' }} />
              <b style={{ fontSize: 14 }}>الخبر: {round.news.headline}</b>
            </span>
            <span className="row" style={{ gap: 6 }}>
              <Pill tone={round.news.searched ? 'info' : 'warn'}>{round.news.searched ? 'بحث في الويب' : 'بلا بحث'}</Pill>
              <Icon name="chevron-down" size={16} style={{ transform: newsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </span>
          </button>
          {newsOpen && (
            <div className="mt-2 fade-in" style={{ fontSize: 14, lineHeight: 1.9 }}>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{round.news.brief}</p>
              {round.news.note && <p className="subtle mt-1" style={{ margin: 0 }}>{round.news.note}</p>}
              {round.news.sources.length > 0 && (
                <div className="row mt-2" style={{ gap: 6 }}>
                  {round.news.sources.map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noreferrer noopener" className="chip" style={{ textDecoration: 'none' }}>
                      <Icon name="globe" size={12} /> {s.title.slice(0, 40)}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Stepper items={posts.map((p, i) => (i === idx ? 'active' : p.rating === 'liked' ? 'done' : p.rating === 'disliked' ? 'bad' : 'pending'))} />

      <div className="post-nav mt-2 mb-2">
        <IconButton icon="chevron-right" label="السابق" onClick={() => goTo(idx - 1)} disabled={idx === 0} />
        <span className="row" style={{ gap: 8 }}>
          <b>البوست {idx + 1} من {posts.length}</b>
          {cur.rating && <Pill tone={cur.rating === 'liked' ? 'success' : 'danger'}>{cur.rating === 'liked' ? 'أعجبك' : 'رفضته'}</Pill>}
        </span>
        <IconButton icon="chevron-left" label="التالي" onClick={() => goTo(idx + 1)} disabled={idx === posts.length - 1} />
      </div>

      <div key={cur.id} className={`fade-up ${leaving ? `leaving-${leaving}` : ''}`}>
        <div className="row mb-1" style={{ gap: 6 }}>
          <Pill tone="brand">{cur.topic}</Pill>
          {cur.hookType && <Pill>{cur.hookType}</Pill>}
          {cur.exploratory && <Pill tone="violet" icon="flask">استكشافي</Pill>}
          {cur.verified && <Pill tone="info" icon="shield-check">{cur.verificationNote ? 'صُحح قانونياً' : 'متحقق قانونياً'}</Pill>}
        </div>
        {cur.verificationNote && <p className="subtle mb-1">{cur.verificationNote}</p>}

        <PostPreview
          content={cur.content}
          subtitle={stats.spec}
          editing={
            manual !== null ? (
              <div className="stack" style={{ gap: 8 }}>
                <textarea className="textarea" value={manual} onChange={(e) => setManual(e.target.value)} autoFocus />
                <div className="row end">
                  <Button size="sm" variant="ghost" onClick={() => setManual(null)}>إلغاء</Button>
                  <Button size="sm" variant="primary" onClick={saveManual} icon="check">حفظ التعديل</Button>
                </div>
              </div>
            ) : undefined
          }
        />

        <div className="tool-row mt-2">
          <Button size="sm" icon="copy" onClick={() => copyText(cur.content)}>نسخ</Button>
          <Button size="sm" icon="pencil" onClick={() => setManual(cur.content)} disabled={manual !== null}>تعديل يدوي</Button>
          <Button size="sm" icon="wand" onClick={() => setAiOpen((o) => !o)} className={aiOpen ? 'btn-success' : ''}>تعديل بالذكاء</Button>
          <Button size="sm" icon="image" onClick={() => setImgOpen((o) => !o)} className={imgOpen ? 'btn-success' : ''}>صورة</Button>
          <Button size="sm" icon={cur.savedId ? 'bookmark-check' : 'bookmark'} onClick={() => toggleSave(cur)} disabled={saveBusy} className={cur.savedId ? 'btn-success' : ''}>
            {cur.savedId ? 'محفوظ' : 'احفظ'}
          </Button>
        </div>

        {aiOpen && (
          <div className="card mt-2 fade-in" style={{ padding: 14 }}>
            <div className="input-row">
              <input className="input" value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="وش تبي أعدل؟ مثل: خله أقصر، غيّر النبرة، أضف مثال..." onKeyDown={(e) => e.key === 'Enter' && aiEdit()} disabled={aiBusy} autoFocus />
              <Button variant="primary" onClick={aiEdit} disabled={!aiText.trim()} loading={aiBusy} icon="wand">عدّل</Button>
            </div>
          </div>
        )}

        {imgOpen && (
          <div className="card mt-2 fade-in" style={{ padding: 14 }}>
            <ImageGrid endpoint={`/api/posts/${cur.id}/images`} initialImages={cur.images} initialSelectedId={cur.selectedImageId} onSelected={(img: ImageRecord) => patch(cur.id, { selectedImageId: img.id, images: [...cur.images.filter((i) => i.id !== img.id), img] })} />
          </div>
        )}
      </div>

      {askReason ? (
        <div className="rate-bar mt-3 fade-in" style={{ display: 'block' }}>
          <div className="row between mb-1">
            <b style={{ fontSize: 14 }}>وش اللي ما عجبك؟ <span className="subtle" style={{ fontWeight: 400 }}>اختر كل ما ينطبق</span></b>
            <button className="btn btn-ghost btn-sm" onClick={() => rate(false)}>تخطي</button>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {DISLIKE_REASON_OPTIONS.map((r) => {
              const on = reasonKeys.includes(r.key);
              return (
                <button key={r.key} type="button" className={`chip ${on ? 'active' : ''}`} aria-pressed={on} onClick={() => setReasonKeys((prev) => (on ? prev.filter((k) => k !== r.key) : [...prev, r.key]))}>
                  {on && <Icon name="check" size={13} />} {r.label}
                </button>
              );
            })}
          </div>
          <div className="input-row mt-2">
            <input
              className="input"
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              placeholder="سبب آخر بكلماتك (اختياري)"
              maxLength={120}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (reasonKeys.length || otherReason.trim())) submitDislike();
              }}
            />
            <Button variant="danger" icon="thumbs-down" onClick={submitDislike} disabled={!reasonKeys.length && !otherReason.trim()}>
              رفض{reasonKeys.length + (otherReason.trim() ? 1 : 0) > 1 ? ` (${reasonKeys.length + (otherReason.trim() ? 1 : 0)} أسباب)` : ''}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rate-bar mt-3">
          <button className={`rate-btn dislike ${cur.rating === 'disliked' ? 'chosen' : ''}`} onClick={() => setAskReason(true)}>
            <Icon name="thumbs-down" size={20} /> ما عجبني
          </button>
          <button className={`rate-btn like ${cur.rating === 'liked' ? 'chosen' : ''}`} onClick={() => rate(true)}>
            <Icon name="thumbs-up" size={20} /> عجبني
          </button>
        </div>
      )}
      <p className="subtle text-center mt-2">كل تقييم يُحلَّل في الخلفية، وكل 3 تقييمات يتحدث ملف أسلوبك</p>
    </div>
  );
}
