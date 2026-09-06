'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { OnboardQuestion, Round } from '@/lib/types';
import { api, errorMessage } from '@/lib/client/api';
import { ErrorToast, Icon3D, LoadingScreen } from './ui';

interface Props {
  questions: OnboardQuestion[];
  specOptions: string[];
}

export function OnboardingWizard({ questions, specOptions }: Props) {
  const router = useRouter();
  const [spec, setSpec] = useState('');
  const [step, setStep] = useState(-1); // -1 = التخصص
  const [choices, setChoices] = useState<Array<'a' | 'b'>>([]);
  const [phase, setPhase] = useState<'form' | 'saving' | 'generating' | 'error'>('form');
  const [err, setErr] = useState('');

  async function finish(all: Array<'a' | 'b'>) {
    setPhase('saving');
    setErr('');
    try {
      await api('/api/onboarding', { method: 'POST', json: { spec: spec.trim(), choices: all } });
      await firstRound();
    } catch (e) {
      // 409 = محفوظ مسبقاً → نكمل للتوليد
      if (e instanceof Error && /مسبقاً/.test(e.message)) await firstRound();
      else {
        setErr(errorMessage(e));
        setPhase('error');
      }
    }
  }

  async function firstRound() {
    setPhase('generating');
    try {
      const { round } = await api<{ round: Round }>('/api/rounds', { method: 'POST', json: {} });
      router.push(`/round/${round.id}`);
    } catch (e) {
      setErr(errorMessage(e));
      setPhase('error');
    }
  }

  function pick(choice: 'a' | 'b') {
    const all = [...choices, choice];
    setChoices(all);
    if (step < questions.length - 1) setTimeout(() => setStep((s) => s + 1), 250);
    else finish(all);
  }

  if (phase === 'saving' || phase === 'generating') {
    return <LoadingScreen title={phase === 'saving' ? 'يحفظ ذوقك...' : 'يكتب أول 4 بوستات...'} subtitle="أول جولة تأخذ قرابة دقيقة" />;
  }

  if (phase === 'error') {
    return (
      <div className="center-screen">
        <div className="container fade-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>😬</div>
          <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 12 }}>ما قدرنا نولّد أول جولة</h2>
          <ErrorToast message={err} />
          <button className="btn-primary" onClick={firstRound}>حاول مرة ثانية</button>
        </div>
      </div>
    );
  }

  if (step === -1) {
    return (
      <div className="center-screen">
        <div className="container fade-in" style={{ textAlign: 'center' }}>
          <img src="/icon.svg" alt="بصمة" width={72} height={72} style={{ borderRadius: 20, display: 'block', margin: '0 auto 24px' }} />
          <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>بصمة</h1>
          <p className="note" style={{ fontSize: 16, maxWidth: 400, margin: '0 auto 32px' }}>
            5 أسئلة سريعة عشان بصمة يفهم ذوقك
            <br />
            وبعدها يكتب بوستات جديدة + صور بالذكاء الاصطناعي
          </p>
          <div className="card" style={{ marginBottom: 20, textAlign: 'right' }}>
            <div className="row" style={{ marginBottom: 14 }}>
              <Icon3D color="cyan">💼</Icon3D>
              <div style={{ fontSize: 16, fontWeight: 800 }}>وش تخصصك؟</div>
            </div>
            <input className="input-field" value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="مثل: ريادة الأعمال، التسويق الرقمي..." />
            <div className="row" style={{ marginTop: 12 }}>
              {specOptions.map((s) => (
                <button key={s} onClick={() => setSpec(s)} className={`spec-chip ${spec === s ? 'active' : ''}`}>{s}</button>
              ))}
            </div>
          </div>
          <button className="btn-primary" disabled={spec.trim().length < 2} onClick={() => setStep(0)}>التالي ←</button>
        </div>
      </div>
    );
  }

  const q = questions[step];
  return (
    <div style={{ padding: '32px 16px', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <div className="container">
        <div className="row between" style={{ marginBottom: 28 }}>
          <div className="row">
            <Icon3D color="gold">❓</Icon3D>
            <span className="note" style={{ fontWeight: 600, fontSize: 15 }}>سؤال {step + 1}/{questions.length}</span>
          </div>
          <div className="progress-bar">
            {questions.map((_, i) => (
              <div key={i} className={`progress-dot ${i < step ? 'done' : i === step ? 'active' : 'pending'}`} />
            ))}
          </div>
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 900, textAlign: 'center', marginBottom: 28 }}>{q.q}</h2>
        <div key={step} className="fade-in stack" style={{ gap: 14 }}>
          {(['a', 'b'] as const).map((ch, i) => {
            const opt = ch === 'a' ? q.a : q.b;
            return (
              <button key={ch} onClick={() => pick(ch)} className="card card-interactive" style={{ textAlign: 'right', width: '100%', display: 'block', animationDelay: `${i * 0.1}s` }}>
                <div className="row" style={{ marginBottom: 10 }}>
                  <Icon3D color={ch === 'a' ? 'cyan' : 'pink'}>{ch === 'a' ? '🅰️' : '🅱️'}</Icon3D>
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{opt.label}</span>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.9, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', paddingRight: 56 }}>{opt.text}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
