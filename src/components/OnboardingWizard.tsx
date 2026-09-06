'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { OnboardQuestion, Round } from '@/lib/types';
import type { FieldOption } from '@/lib/seed';
import { api, errorMessage } from '@/lib/client/api';
import { Button, GenerationLoader, Pill, PostPreview, Stepper, useToast } from './ui';
import { Icon } from './icons';

type Step = 'welcome' | 'field' | 'style' | 'ready' | 'generating' | 'error';
type Choice = 'a' | 'b' | 'skip';

interface Props {
  questions: OnboardQuestion[];
  fields: FieldOption[];
  defaultSpec: string;
}

export function OnboardingWizard({ questions, fields, defaultSpec }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>('welcome');
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [qIdx, setQIdx] = useState(0);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  const spec = [...fields.filter((f) => selected.includes(f.key)).map((f) => f.label), custom.trim()].filter(Boolean).join('، ') || defaultSpec;
  const chosenRules = choices.map((c, i) => (c === 'skip' ? null : c === 'a' ? questions[i].a.rule : questions[i].b.rule)).filter(Boolean) as string[];

  function toggleField(key: string) {
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : s.length >= 2 ? [s[1], key] : [...s, key]));
  }

  function answer(c: Choice) {
    const all = [...choices, c];
    setChoices(all);
    if (qIdx < questions.length - 1) setTimeout(() => setQIdx((i) => i + 1), 180);
    else setStep('ready');
  }

  async function start() {
    setStep('generating');
    setErr('');
    try {
      if (!saved) {
        try {
          await api('/api/onboarding', { method: 'POST', json: { spec, choices } });
        } catch (e) {
          if (!(e instanceof Error && /مسبقاً/.test(e.message))) throw e;
        }
        setSaved(true);
      }
      const { round } = await api<{ round: Round }>('/api/rounds', { method: 'POST', json: {} });
      router.push(`/round/${round.id}`);
    } catch (e) {
      setErr(errorMessage(e));
      setStep('error');
    }
  }

  if (step === 'generating') return <GenerationLoader title="يكتب أول 4 بوستات بأسلوبك" subtitle={`التخصص: ${spec}`} />;

  if (step === 'error') {
    return (
      <div className="hero">
        <div className="hero-inner text-center" style={{ maxWidth: 480 }}>
          <div className="icon-bubble danger" style={{ width: 64, height: 64, borderRadius: 20, margin: '0 auto 16px', display: 'grid', placeItems: 'center' }}>
            <Icon name="alert" size={30} />
          </div>
          <h2 style={{ fontSize: 24, marginBottom: 8 }}>ما قدرنا نولّد أول جولة</h2>
          <p className="muted mb-3">{err}</p>
          <Button variant="primary" onClick={start} icon="refresh">حاول مرة ثانية</Button>
        </div>
      </div>
    );
  }

  if (step === 'welcome') {
    return (
      <div className="hero">
        <div className="hero-inner text-center fade-up">
          <div className="brand-hero" style={{ margin: '0 auto 26px' }}>
            <Icon name="fingerprint" size={38} />
          </div>
          <h1 className="hero-title" style={{ marginBottom: 14 }}>
            بصمة يكتب LinkedIn <span className="grad-text">بأسلوبك أنت</span>
          </h1>
          <p className="hero-sub" style={{ margin: '0 auto 28px' }}>
            قيّم البوستات بإعجاب أو رفض، وبصمة يستخلص أسلوبك ويكتب أقرب لذوقك في كل جولة. بدون كتابة، اختيارات فقط.
          </p>
          <div className="value-props text-center" style={{ marginBottom: 30 }}>
            <div className="value-prop" style={{ alignItems: 'center' }}>
              <Icon name="brain" size={22} style={{ color: 'var(--violet)' }} />
              <b>ملف أسلوب يتطور</b>
              <span>يُستخلص من إعجاباتك ورفضك</span>
            </div>
            <div className="value-prop" style={{ alignItems: 'center' }}>
              <Icon name="sparkles" size={22} style={{ color: 'var(--brand)' }} />
              <b>4 بوستات كل جولة</b>
              <span>زوايا مختلفة، وواحد يجرب شيئاً جديداً</span>
            </div>
            <div className="value-prop" style={{ alignItems: 'center' }}>
              <Icon name="image" size={22} style={{ color: 'var(--brand-2)' }} />
              <b>صور بأربعة أنماط</b>
              <span>تتعلم من اختياراتك أيضاً</span>
            </div>
          </div>
          <Button variant="primary" size="lg" onClick={() => setStep('field')} icon="arrow-left">
            ابدأ في دقيقة
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'field') {
    return (
      <div className="hero" style={{ alignItems: 'start', paddingTop: 48 }}>
        <div className="hero-inner fade-up">
          <div className="eyebrow mb-1">الخطوة 1 من 3</div>
          <h2 style={{ fontSize: 28, marginBottom: 6 }}>عن ماذا تكتب غالباً؟</h2>
          <p className="muted mb-3">اختر مجالاً أو اثنين، أو تخطَّ وسيتعلم بصمة من تقييماتك.</p>
          <div className="choice-grid mb-2">
            {fields.map((f) => {
              const on = selected.includes(f.key);
              return (
                <button key={f.key} type="button" className={`choice-card ${on ? 'selected' : ''}`} onClick={() => toggleField(f.key)}>
                  <span className="icon-bubble">
                    <Icon name={f.icon} size={20} />
                  </span>
                  <span className="c-title">{f.label}</span>
                  <span className="c-sub">{f.sub}</span>
                  {on && (
                    <span className="check">
                      <Icon name="check" size={13} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
            <button type="button" className={`choice-card ${showCustom ? 'selected' : ''}`} onClick={() => setShowCustom((s) => !s)}>
              <span className="icon-bubble">
                <Icon name="more" size={20} />
              </span>
              <span className="c-title">مجال آخر</span>
              <span className="c-sub">اكتبه بكلمتين</span>
            </button>
          </div>
          {showCustom && <input className="input input-lg mb-2 fade-in" autoFocus value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="مثل: العقارات، الصحة، القانون..." maxLength={60} />}
          <div className="row between mt-2">
            <Button variant="ghost" onClick={() => setStep('style')} icon="skip-forward">
              تخطي
            </Button>
            <Button variant="primary" size="lg" disabled={selected.length === 0 && !custom.trim()} onClick={() => setStep('style')} icon="arrow-left">
              التالي
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'style') {
    const q = questions[qIdx];
    return (
      <div className="hero" style={{ alignItems: 'start', paddingTop: 48 }}>
        <div className="hero-inner" style={{ maxWidth: 860 }}>
          <div className="row between mb-2">
            <div>
              <div className="eyebrow mb-1">الخطوة 2 من 3 · {qIdx + 1}/{questions.length}</div>
              <h2 style={{ fontSize: 28 }}>{q.q}</h2>
              <p className="muted">اضغط على البوست الأقرب لأسلوبك</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => answer('skip')} icon="skip-forward">
              تخطي
            </Button>
          </div>
          <Stepper items={questions.map((_, i) => (i < qIdx ? 'done' : i === qIdx ? 'active' : 'pending'))} />
          <div key={qIdx} className="ab-grid mt-3 fade-up">
            {(['a', 'b'] as const).map((k) => {
              const opt = k === 'a' ? q.a : q.b;
              return (
                <button key={k} type="button" className="ab-option" onClick={() => answer(k)}>
                  <span className="ab-label">
                    <span className="ab-key">{k === 'a' ? 'A' : 'B'}</span>
                    {opt.label}
                  </span>
                  <PostPreview content={opt.text} subtitle={spec} collapsible={false} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ready
  return (
    <div className="hero">
      <div className="hero-inner scale-in" style={{ maxWidth: 560 }}>
        <div className="card card-lg card-accent text-center">
          <div className="icon-bubble success" style={{ width: 64, height: 64, borderRadius: 20, margin: '0 auto 16px', display: 'grid', placeItems: 'center' }}>
            <Icon name="check" size={30} strokeWidth={2.5} />
          </div>
          <div className="eyebrow mb-1">الخطوة 3 من 3</div>
          <h2 style={{ fontSize: 26, marginBottom: 8 }}>جاهز! هذه بصمتك الأولى</h2>
          <p className="muted mb-3">ستتطور مع كل تقييم. الآن نكتب أول 4 بوستات.</p>
          <div className="row center mb-2">
            <Pill tone="brand" icon="briefcase">{spec}</Pill>
            {chosenRules.map((r) => (
              <Pill key={r} tone="violet">{r}</Pill>
            ))}
            {chosenRules.length === 0 && <Pill>بدون تفضيلات مسبقة، سيتعلم من تقييماتك</Pill>}
          </div>
          <Button variant="primary" size="lg" block onClick={start} icon="sparkles">
            ولّد أول 4 بوستات
          </Button>
          <button className="btn btn-ghost btn-sm mt-2" onClick={() => { setChoices([]); setQIdx(0); setStep('style'); }}>
            أعد اختيار الأسلوب
          </button>
          {err && <p className="subtle mt-2" style={{ color: 'var(--danger)' }}>{err}</p>}
        </div>
      </div>
    </div>
  );
}
