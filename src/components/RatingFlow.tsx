'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AppStats, ImageRecord, PostWithImages, Round } from '@/lib/types';
import { api, errorMessage } from '@/lib/client/api';
import { ImageGrid } from './ImageGrid';
import { ErrorToast, Icon3D, LoadingScreen, useFlash, SuccessFlash } from './ui';

interface Props {
  round: Round;
  initialPosts: PostWithImages[];
  stats: AppStats;
}

export function RatingFlow({ round, initialPosts, stats }: Props) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const firstUnrated = posts.findIndex((p) => p.rating === null);
  const [idx, setIdx] = useState(firstUnrated === -1 ? posts.length : firstUnrated);
  const [likedCurrent, setLikedCurrent] = useState(false);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useFlash();
  const [manualEdit, setManualEdit] = useState<string | null>(null);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [generating, setGenerating] = useState(false);

  const liked = stats.liked + posts.filter((p) => p.rating === 'liked' && !initialPosts.find((i) => i.id === p.id)?.rating).length;
  const disliked = stats.disliked + posts.filter((p) => p.rating === 'disliked' && !initialPosts.find((i) => i.id === p.id)?.rating).length;
  const cur = posts[idx];
  const done = !cur;

  function patch(id: string, data: Partial<PostWithImages>) {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
  }

  async function rate(likedIt: boolean) {
    if (!cur) return;
    setErr('');
    try {
      const { post } = await api<{ post: PostWithImages }>(`/api/posts/${cur.id}/rate`, { method: 'POST', json: { liked: likedIt } });
      patch(cur.id, { rating: post.rating, ratedAt: post.ratedAt });
      if (likedIt) setLikedCurrent(true);
      else setTimeout(next, 300);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  function next() {
    setLikedCurrent(false);
    setAiInstruction('');
    setManualEdit(null);
    setIdx((i) => i + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveManual() {
    if (!cur || manualEdit === null || !manualEdit.trim()) return;
    try {
      const { post } = await api<{ post: PostWithImages }>(`/api/posts/${cur.id}`, { method: 'PATCH', json: { content: manualEdit } });
      patch(cur.id, { content: post.content, originalContent: post.originalContent });
      setManualEdit(null);
      setFlash('تم حفظ تعديلك — بصمة بيتعلم من الفرق');
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function aiEdit() {
    if (!cur || !aiInstruction.trim() || aiBusy) return;
    setAiBusy(true);
    setErr('');
    try {
      const { post, summary } = await api<{ post: PostWithImages; summary: string }>(`/api/posts/${cur.id}/edit`, { method: 'POST', json: { instruction: aiInstruction } });
      patch(cur.id, { content: post.content, originalContent: post.originalContent });
      setAiInstruction('');
      setFlash(summary || 'تم التعديل');
    } catch (e) {
      setErr(errorMessage(e));
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
      } else {
        const { saved } = await api<{ saved: { id: string } }>('/api/saved', { method: 'POST', json: { postId: p.id } });
        patch(p.id, { savedId: saved.id });
        setFlash('تم حفظ البوست في المحفوظات');
      }
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setSaveBusy(false);
    }
  }

  async function newRound() {
    setGenerating(true);
    setErr('');
    try {
      const { round: r } = await api<{ round: Round }>('/api/rounds', { method: 'POST', json: {} });
      router.push(`/round/${r.id}`);
    } catch (e) {
      setErr(errorMessage(e));
      setGenerating(false);
    }
  }

  if (generating) return <LoadingScreen title="يكتب بوستات أقرب لذوقك..." subtitle={`يستخدم ${liked} مثال ناجح وملف أسلوبك الحالي`} />;

  // ===== ملخص الجولة =====
  if (done) {
    const roundLiked = posts.filter((p) => p.rating === 'liked').length;
    const roundDisliked = posts.filter((p) => p.rating === 'disliked').length;
    return (
      <div className="page">
        <div className="container">
          <div className="fade-in" style={{ textAlign: 'center', marginBottom: 28 }}>
            <Icon3D color="gold" size="lg">🎉</Icon3D>
            <h2 style={{ fontSize: 26, fontWeight: 900, margin: '20px 0 6px' }}>الجولة {round.id} خلصت!</h2>
            <p className="note">
              {stats.ratingsSinceProfile + posts.length >= 3 ? 'بصمة يحدّث ملف أسلوبك في الخلفية الآن' : 'بصمة سجّل تقييماتك'}
            </p>
          </div>
          <ErrorToast message={err} onClose={() => setErr('')} />
          <SuccessFlash message={flash} />
          <div className="grid-2 fade-in-up" style={{ marginBottom: 20 }}>
            <div className="stat-box green-bg"><div style={{ fontSize: 26, fontWeight: 900, color: 'var(--green)' }}>{roundLiked}</div><div className="note">👍 في هذه الجولة</div></div>
            <div className="stat-box red-bg"><div style={{ fontSize: 26, fontWeight: 900, color: 'var(--red)' }}>{roundDisliked}</div><div className="note">👎 في هذه الجولة</div></div>
            <div className="stat-box gold-bg"><div style={{ fontSize: 26, fontWeight: 900, color: 'var(--gold)' }}>{liked}</div><div className="note">إجمالي المعجَب به</div></div>
            <div className="stat-box cyan-bg"><div style={{ fontSize: 26, fontWeight: 900, color: 'var(--cyan)' }}>{stats.profileVersion ?? '—'}</div><div className="note">إصدار ملف الأسلوب</div></div>
          </div>
          <div className="stack" style={{ marginBottom: 24 }}>
            {posts.map((p) => (
              <div key={p.id} className="card" style={{ padding: 18 }}>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <div className="row">
                    <span className="topic-tag" style={{ marginBottom: 0 }}>{p.rating === 'liked' ? '👍' : '👎'} {p.topic}</span>
                    {p.exploratory && <span className="pill accent">استكشافي</span>}
                  </div>
                  <button className={`btn-small ${p.savedId ? 'primary' : ''}`} disabled={saveBusy} onClick={() => toggleSave(p)}>
                    {p.savedId ? '🔖 محفوظ' : '📌 احفظ'}
                  </button>
                </div>
                <div className="post-body" style={{ fontSize: 14, maxHeight: 120, overflow: 'hidden', maskImage: 'linear-gradient(#000 70%, transparent)' }}>{p.content}</div>
              </div>
            ))}
          </div>
          <div className="stack">
            <button className="btn-primary" onClick={newRound}>✨ جولة جديدة — بوستات أقرب لذوقك</button>
            <Link href="/" className="btn-secondary" style={{ textAlign: 'center', textDecoration: 'none' }}>الرئيسية</Link>
          </div>
        </div>
      </div>
    );
  }

  // ===== تقييم بوست =====
  return (
    <div className="page">
      <div className="container">
        <div className="fade-in row between" style={{ marginBottom: 20 }}>
          <div className="row">
            <Icon3D color="accent">📝</Icon3D>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 2 }}>قيّم البوست</h2>
              <div className="note">الجولة {round.id} · {idx + 1}/{posts.length}{round.topic ? ` · ${round.topic}` : ''}</div>
            </div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <span className="tag green" style={{ fontSize: 12 }}>👍 {liked}</span>
            <span className="tag red" style={{ fontSize: 12 }}>👎 {disliked}</span>
          </div>
        </div>

        <div className="progress-bar" style={{ marginBottom: 20 }}>
          {posts.map((p, i) => (
            <div key={p.id} className={`progress-dot ${i < idx ? 'done' : i === idx ? 'active' : 'pending'}`} />
          ))}
        </div>

        <div className="row" style={{ marginBottom: 12 }}>
          <span className="topic-tag" style={{ marginBottom: 0 }}>📌 {cur.topic}</span>
          {cur.exploratory && <span className="pill accent" title="بوست يجرب أسلوباً جديداً ليتعلم حدود ذوقك">🧪 استكشافي</span>}
          {cur.hookType && <span className="pill">{cur.hookType}</span>}
          {cur.verified && <span className="pill cyan" title={cur.verificationNote ?? 'تم التحقق من نظام العمل'}>⚖️ {cur.verificationNote ? 'صُحح قانونياً' : 'متحقق قانونياً'}</span>}
        </div>
        {cur.verificationNote && <div className="note" style={{ marginBottom: 12 }}>⚖️ {cur.verificationNote}</div>}

        <div key={cur.id} className="card fade-in" style={{ marginBottom: 14 }}>
          {manualEdit === null ? (
            <div className="post-body">{cur.content}</div>
          ) : (
            <div>
              <textarea className="textarea-field" value={manualEdit} onChange={(e) => setManualEdit(e.target.value)} style={{ minHeight: 200 }} />
              <div className="row end" style={{ marginTop: 10 }}>
                <button className="memory-edit-save" onClick={saveManual}>حفظ</button>
                <button className="memory-edit-cancel" onClick={() => setManualEdit(null)}>إلغاء</button>
              </div>
            </div>
          )}
          {manualEdit === null && (
            <div className="row end" style={{ marginTop: 12 }}>
              <button className="btn-small" onClick={() => navigator.clipboard.writeText(cur.content).then(() => setFlash('تم النسخ'))}>📋 نسخ</button>
              <button className="btn-small" onClick={() => setManualEdit(cur.content)}>✏️ تعديل يدوي</button>
            </div>
          )}
        </div>

        <div className="post-edit-box" style={{ marginBottom: 18 }}>
          <div className="post-edit-row">
            <input
              className="input-field post-edit-input"
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              placeholder="عدّل بالذكاء... مثل: خله أقصر، غيّر النبرة، أضف مثال"
              onKeyDown={(e) => e.key === 'Enter' && aiEdit()}
              disabled={aiBusy}
            />
            <button className="post-edit-btn" disabled={!aiInstruction.trim() || aiBusy} onClick={aiEdit}>
              {aiBusy ? '⏳' : '🤖'}
            </button>
          </div>
        </div>

        <ImageGrid endpoint={`/api/posts/${cur.id}/images`} initialImages={cur.images} initialSelectedId={cur.selectedImageId} onSelected={(img: ImageRecord) => patch(cur.id, { selectedImageId: img.id })} />

        <ErrorToast message={err} onClose={() => setErr('')} />
        <SuccessFlash message={flash} />

        {!likedCurrent ? (
          <div className="row" style={{ gap: 14, marginBottom: 14, flexWrap: 'nowrap' }}>
            <button className="btn-rate dislike" onClick={() => rate(false)} disabled={cur.rating !== null}>👎 ما عجبني</button>
            <button className="btn-rate like" onClick={() => rate(true)} disabled={cur.rating !== null}>👍 عجبني</button>
          </div>
        ) : (
          <div className="fade-in" style={{ marginBottom: 14 }}>
            <div style={{ textAlign: 'center', marginBottom: 12, color: 'var(--green)', fontWeight: 700, fontSize: 15 }}>✓ تم تسجيل إعجابك — بصمة بيتعلم من هالأسلوب</div>
            <button className="btn-primary" onClick={next}>التالي ←</button>
          </div>
        )}

        <button className={`btn-save-post ${cur.savedId ? 'saved' : ''}`} onClick={() => toggleSave(cur)} disabled={saveBusy} style={{ marginBottom: 20 }}>
          {cur.savedId ? '🔖 محفوظ' : '📌 احفظ البوست'}
        </button>

        <div className="note" style={{ textAlign: 'center' }}>🌊 كل تقييم يُحلَّل في الخلفية ويحسّن الجولة الجاية</div>
      </div>
    </div>
  );
}
