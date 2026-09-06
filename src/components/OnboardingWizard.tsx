'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Round } from '@/lib/types';
import type { ChipOption, FieldOption } from '@/lib/seed';
import { api, errorMessage } from '@/lib/client/api';
import { Button, GenerationLoader, Pill } from './ui';
import { BulkPaste } from './BulkPaste';
import { Icon } from './icons';

type Step = 'welcome' | 'field' | 'samples' | 'voice' | 'ready' | 'generating' | 'error';

interface Props {
  fields: FieldOption[];
  voices: ChipOption[];
  languages: ChipOption[];
  avoids: ChipOption[];
  defaultSpec: string;
}

const STEPS: Step[] = ['field', 'samples', 'voice'];

function StepHeader({ title, sub, stepIndex }: { title: string; sub: string; stepIndex: number }) {
  return (
    <div className="mb-3">
      <div className="eyebrow mb-1">الخطوة {stepIndex + 1} من {STEPS.length}</div>
      <h2 style={{ fontSize: 28, marginBottom: 6 }}>{title}</h2>
      <p className="muted">{sub}</p>
      <div className="stepper mt-2" style={{ maxWidth: 240 }}>
        {STEPS.map((s, i) => (
          <span key={s} className={i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''} />
        ))}
      </div>
    </div>
  );
}

export function OnboardingWizard({ fields, voices, languages, avoids, defaultSpec }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [samples, setSamples] = useState<string[]>([]);
  const [voice, setVoice] = useState<string[]>([]);
  const [language, setLanguage] = useState<string | null>('saudi');
  const [avoid, setAvoid] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const [genTitle, setGenTitle] = useState('');

  const spec = [...fields.filter((f) => selected.includes(f.key)).map((f) => f.label), custom.trim()].filter(Boolean).join('، ') || defaultSpec;
  const validSamples = samples;
  const stepIndex = STEPS.indexOf(step);

  const toggle = (list: string[], key: string, max: number) => (list.includes(key) ? list.filter((k) => k !== key) : list.length >= max ? [...list.slice(1), key] : [...list, key]);

  async function start() {
    setStep('generating');
    setErr('');
    try {
      if (!saved) {
        setGenTitle(validSamples.length ? `يستخلص بصمتك من ${validSamples.length} نصاً` : 'يحفظ اختياراتك');
        try {
          await api('/api/onboarding', { method: 'POST', json: { spec, samples: validSamples, voice, language, avoid } });
        } catch (e) {
          if (!(e instanceof Error && /مسبقاً/.test(e.message))) throw e;
        }
        setSaved(true);
      }
      setGenTitle('يكتب أول 4 بوستات بصوتك');
      const { round } = await api<{ round: Round }>('/api/rounds', { method: 'POST', json: {} });
      router.push(`/round/${round.id}`);
    } catch (e) {
      setErr(errorMessage(e));
      setStep('error');
    }
  }

  if (step === 'generating') return <GenerationLoader title={genTitle || 'يجهّز بصمتك'} subtitle={`التخصص: ${spec}`} />;

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
            بصمة يكتب LinkedIn <span className="grad-text">بصوتك أنت</span>
          </h1>
          <p className="hero-sub" style={{ margin: '0 auto 28px' }}>
            يتعلم من نصوصك ومن كل إعجاب أو رفض، ويكتب كإنسان حقيقي لا كأداة. الإعداد دقيقتان، وكل خطوة فيه اختيارية.
          </p>
          <div className="value-props" style={{ marginBottom: 30 }}>
            <div className="value-prop" style={{ alignItems: 'center' }}>
              <Icon name="fingerprint" size={22} style={{ color: 'var(--brand)' }} />
              <b>بصمة من نصوصك</b>
              <span>الصق بوستاً كتبته ويستخلص صوتك فوراً</span>
            </div>
            <div className="value-prop" style={{ alignItems: 'center' }}>
              <Icon name="brain" size={22} style={{ color: 'var(--violet)' }} />
              <b>يتحسن مع كل تقييم</b>
              <span>سبب الرفض بلمسة، وملف أسلوب يتطور</span>
            </div>
            <div className="value-prop" style={{ alignItems: 'center' }}>
              <Icon name="sparkles" size={22} style={{ color: 'var(--brand-2)' }} />
              <b>كتابة بشرية</b>
              <span>بلا عبارات جاهزة ولا حماس مصطنع</span>
            </div>
          </div>
          <Button variant="primary" size="lg" onClick={() => setStep('field')} icon="arrow-left">
            ابدأ
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'field') {
    return (
      <div className="hero" style={{ alignItems: 'start', paddingTop: 48 }}>
        <div className="hero-inner fade-up">
          <StepHeader stepIndex={stepIndex} title="عن ماذا تكتب غالباً؟" sub="اختر مجالاً أو اثنين. يساعد بصمة على اقتراح مواضيع تخصك." />
          <div className="choice-grid mb-2">
            {fields.map((f) => {
              const on = selected.includes(f.key);
              return (
                <button key={f.key} type="button" className={`choice-card ${on ? 'selected' : ''}`} onClick={() => setSelected((s) => toggle(s, f.key, 2))}>
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
            <Button variant="ghost" onClick={() => setStep('samples')} icon="skip-forward">تخطي</Button>
            <Button variant="primary" size="lg" disabled={selected.length === 0 && !custom.trim()} onClick={() => setStep('samples')} icon="arrow-left">التالي</Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'samples') {
    return (
      <div className="hero" style={{ alignItems: 'start', paddingTop: 48 }}>
        <div className="hero-inner fade-up" style={{ maxWidth: 760 }}>
          <StepHeader stepIndex={stepIndex} title="أعطِ بصمة صوتك الحقيقي" sub="كلما زادت نصوصك كان الاستخلاص أدق: الصق عشرات البوستات التي كتبتها، أو ارفع أرشيفك من LinkedIn دفعة واحدة." />
          <div className="card">
            <BulkPaste onParsed={setSamples} />
          </div>
          <div className="card mt-2" style={{ padding: 14, borderStyle: 'dashed' }}>
            <div className="row nowrap" style={{ gap: 10 }}>
              <Icon name="info" size={18} style={{ color: 'var(--info)', flex: 'none' }} />
              <span className="subtle">ما عندك بوستات؟ تخطَّ هذه الخطوة وسيتعلم بصمة من تقييماتك وتعديلاتك، وتقدر تضيف نصوصك لاحقاً من صفحة التدريب.</span>
            </div>
          </div>
          <div className="row between mt-3">
            <Button variant="ghost" onClick={() => setStep('field')} icon="arrow-right">رجوع</Button>
            <div className="row" style={{ gap: 8 }}>
              <Button variant="ghost" onClick={() => setStep('voice')} icon="skip-forward">تخطي</Button>
              <Button variant="primary" size="lg" disabled={validSamples.length === 0} onClick={() => setStep('voice')} icon="arrow-left">
                التالي{validSamples.length ? ` (${validSamples.length})` : ''}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'voice') {
    return (
      <div className="hero" style={{ alignItems: 'start', paddingTop: 48 }}>
        <div className="hero-inner fade-up" style={{ maxWidth: 720 }}>
          <StepHeader stepIndex={stepIndex} title="كيف يبدو صوتك؟" sub="لمسات سريعة، وكلها اختيارية. بصمة يعدّلها لاحقاً مما يتعلمه منك." />
          <div className="card mb-2">
            <div className="row between mb-2">
              <b>صوتك</b>
              <span className="subtle">حتى 3</span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {voices.map((v) => (
                <button key={v.key} type="button" className={`chip ${voice.includes(v.key) ? 'active' : ''}`} onClick={() => setVoice((l) => toggle(l, v.key, 3))}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div className="card mb-2">
            <b className="mb-2" style={{ display: 'block' }}>لغتك</b>
            <div className="row" style={{ gap: 8 }}>
              {languages.map((l) => (
                <button key={l.key} type="button" className={`chip ${language === l.key ? 'active' : ''}`} onClick={() => setLanguage(language === l.key ? null : l.key)}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div className="card mb-2">
            <div className="row between mb-2">
              <b>ما تكرهه في بوستات LinkedIn</b>
              <span className="subtle">يتجنبها بصمة تماماً</span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {avoids.map((a) => (
                <button key={a.key} type="button" className={`chip ${avoid.includes(a.key) ? 'active' : ''}`} onClick={() => setAvoid((l) => toggle(l, a.key, 12))} style={avoid.includes(a.key) ? { borderColor: 'var(--danger)', color: 'var(--danger)', background: 'var(--danger-soft)' } : undefined}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <div className="row between mt-3">
            <Button variant="ghost" onClick={() => setStep('samples')} icon="arrow-right">رجوع</Button>
            <Button variant="primary" size="lg" onClick={() => setStep('ready')} icon="arrow-left">التالي</Button>
          </div>
        </div>
      </div>
    );
  }

  // ready
  const chips = [
    ...voices.filter((v) => voice.includes(v.key)).map((v) => v.label),
    ...languages.filter((l) => l.key === language).map((l) => l.label),
  ];
  return (
    <div className="hero">
      <div className="hero-inner scale-in" style={{ maxWidth: 560 }}>
        <div className="card card-lg card-accent text-center">
          <div className="icon-bubble success" style={{ width: 64, height: 64, borderRadius: 20, margin: '0 auto 16px', display: 'grid', placeItems: 'center' }}>
            <Icon name="check" size={30} strokeWidth={2.5} />
          </div>
          <h2 style={{ fontSize: 26, marginBottom: 8 }}>جاهز</h2>
          <p className="muted mb-3">
            {validSamples.length ? `سيستخلص بصمتك من ${validSamples.length} نصاً من كتابتك ثم يكتب أول 4 بوستات بصوتك.` : 'سيكتب أول 4 بوستات بأشكال مختلفة ويتعلم من تقييمك لها.'}
          </p>
          <div className="row center mb-2" style={{ gap: 6 }}>
            <Pill tone="brand" icon="briefcase">{spec}</Pill>
            {chips.map((c) => <Pill key={c} tone="violet">{c}</Pill>)}
            {avoid.length > 0 && <Pill tone="danger" icon="x">يتجنب {avoid.length}</Pill>}
          </div>
          <Button variant="primary" size="lg" block onClick={start} icon="sparkles">
            ولّد أول 4 بوستات
          </Button>
          <button className="btn btn-ghost btn-sm mt-2" onClick={() => setStep('voice')}>رجوع</button>
          {err && <p className="subtle mt-2" style={{ color: 'var(--danger)' }}>{err}</p>}
        </div>
      </div>
    </div>
  );
}
