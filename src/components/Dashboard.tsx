'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AppStats, Round, StyleProfile } from '@/lib/types';
import { api, errorMessage } from '@/lib/client/api';
import { ErrorToast, LoadingScreen } from './ui';

interface Props {
  stats: AppStats;
  profile: StyleProfile | null;
  goldenRules: string[];
  currentRound: Round | null;
}

export function Dashboard({ stats, profile, goldenRules, currentRound }: Props) {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function generate() {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      const { round } = await api<{ round: Round }>('/api/rounds', { method: 'POST', json: { topic: topic.trim() || undefined } });
      router.push(`/round/${round.id}`);
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <LoadingScreen
        title={stats.rounds > 0 ? 'يكتب بوستات أقرب لذوقك...' : 'يكتب أول بوستات...'}
        subtitle={`يستخدم ${stats.liked} مثال ناجح، ${stats.goldenRules} قاعدة ذهبية${profile ? `، وملف الأسلوب v${profile.version}` : ''} · ${stats.exploratoryNext} من 4 استكشافي`}
      />
    );
  }

  return (
    <div className="center-screen">
      <div className="container fade-in" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 72, margin: '0 auto 20px', lineHeight: 1 }}>👋</div>
        <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 6 }}>أهلاً! بصمة يتذكرك</h1>
        <p className="note" style={{ fontSize: 15, marginBottom: 20 }}>التخصص: {stats.spec}</p>

        <div className="row" style={{ justifyContent: 'center', marginBottom: 24 }}>
          <span className="tag green">👍 {stats.liked}</span>
          <span className="tag red">👎 {stats.disliked}</span>
          <span className="tag gold">⭐ {stats.goldenRules} قاعدة</span>
          <span className="tag cyan">🔁 {stats.rounds} جولة</span>
          {profile && <span className="tag purple">🧬 أسلوب v{profile.version}</span>}
        </div>

        {currentRound?.status === 'rating' && (
          <div className="section-panel cyan-panel" style={{ marginBottom: 16, textAlign: 'right' }}>
            <div className="row between">
              <div>
                <div style={{ fontWeight: 800, color: 'var(--cyan)', marginBottom: 4 }}>عندك جولة ما خلصت تقييمها</div>
                <div className="note">الجولة {currentRound.id}{currentRound.topic ? ` · ${currentRound.topic}` : ''}</div>
              </div>
              <Link href={`/round/${currentRound.id}`} className="btn-small primary" style={{ textDecoration: 'none' }}>أكمل التقييم ←</Link>
            </div>
          </div>
        )}

        {profile && (
          <div className="section-panel purple-panel" style={{ marginBottom: 16, textAlign: 'right' }}>
            <div className="row between" style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--purple)' }}>🧬 ملف أسلوبك</div>
              <Link href="/profile" className="note" style={{ textDecoration: 'underline' }}>التفاصيل</Link>
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>{profile.data.summary}</div>
          </div>
        )}

        {goldenRules.length > 0 && (
          <div className="section-panel gold-panel" style={{ marginBottom: 16, textAlign: 'right' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)', marginBottom: 10 }}>⭐ القواعد الذهبية</div>
            {goldenRules.slice(0, 5).map((r, i) => (
              <div key={i} className="slide-in" style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6, animationDelay: `${i * 0.08}s` }}>✓ {r}</div>
            ))}
          </div>
        )}

        <div className="card" style={{ marginBottom: 16, textAlign: 'right', padding: 22 }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="icon-3d icon-3d-sm purple">💡</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>موضوع البوست</div>
              <div className="note">اختياري — اتركه فاضي وبصمة يختار مواضيع جديدة</div>
            </div>
          </div>
          <input className="input-field" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="مثل: أهمية التسويق بالمحتوى، كيف تبدأ مشروعك..." onKeyDown={(e) => e.key === 'Enter' && generate()} />
          <div className="note" style={{ marginTop: 10 }}>
            الجولة الجاية: {4 - stats.exploratoryNext} ملتزم بأسلوبك + {stats.exploratoryNext} استكشافي
          </div>
        </div>

        <ErrorToast message={err} onClose={() => setErr('')} />
        <button className="btn-primary" onClick={generate}>✨ ولّد 4 بوستات جديدة</button>
      </div>
    </div>
  );
}
