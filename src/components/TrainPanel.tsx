'use client';

import { useState } from 'react';
import type { Post, Rule, RuleKind } from '@/lib/types';
import { api, errorMessage } from '@/lib/client/api';
import { Button, EmptyState, IconButton, Switch, useToast } from './ui';
import { Icon, type IconName } from './icons';

const SOURCE_LABEL: Record<Rule['source'], string> = { onboarding: 'إعداد أولي', manual: 'يدوي', learned: 'متعلَّم', imported: 'مستورد' };
const KIND_LABEL: Record<Post['kind'], string> = { seed: 'مثال أولي', reference: 'مرجع', generated: 'مولّد', imported: 'مستورد', own: 'كتبته بنفسي' };

type Tab = 'refs' | 'golden' | 'avoid' | 'images';
const TABS: Array<{ key: Tab; label: string; icon: IconName }> = [
  { key: 'refs', label: 'بوستات مرجعية', icon: 'file-text' },
  { key: 'golden', label: 'قواعد ذهبية', icon: 'zap' },
  { key: 'avoid', label: 'أنماط مرفوضة', icon: 'x' },
  { key: 'images', label: 'ستايل الصور', icon: 'palette' },
];

export function TrainPanel({ rules: initialRules, liked: initialLiked }: { rules: Rule[]; liked: Post[] }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('refs');
  const [rules, setRules] = useState(initialRules);
  const [liked, setLiked] = useState(initialLiked);

  async function addRule(kind: RuleKind, text: string) {
    try {
      const { rule } = await api<{ rule: Rule }>('/api/rules', { method: 'POST', json: { kind, text } });
      setRules((prev) => [...prev, rule]);
      toast.success('أُضيفت القاعدة', 'تُطبَّق من الجولة القادمة');
      return true;
    } catch (e) {
      toast.error('تعذرت الإضافة', errorMessage(e));
      return false;
    }
  }
  async function patchRule(id: number, patch: { text?: string; active?: boolean }) {
    try {
      const { rule } = await api<{ rule: Rule }>(`/api/rules/${id}`, { method: 'PATCH', json: patch });
      setRules((prev) => prev.map((r) => (r.id === id ? rule : r)));
    } catch (e) {
      toast.error('تعذر التعديل', errorMessage(e));
    }
  }
  async function removeRule(id: number) {
    try {
      await api(`/api/rules/${id}`, { method: 'DELETE' });
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      toast.error('تعذر الحذف', errorMessage(e));
    }
  }
  async function addReference(content: string, topic: string, own: boolean) {
    try {
      const { post } = await api<{ post: Post }>('/api/posts', { method: 'POST', json: { content, topic: topic || undefined, own } });
      setLiked((prev) => [post, ...prev]);
      toast.success('أُضيف كمرجع', 'بصمة سيقلّد أسلوبه ويتعلم منه');
      return true;
    } catch (e) {
      toast.error('تعذرت الإضافة', errorMessage(e));
      return false;
    }
  }
  async function patchPost(id: string, patch: { content?: string; topic?: string }) {
    try {
      const { post } = await api<{ post: Post }>(`/api/posts/${id}`, { method: 'PATCH', json: patch });
      setLiked((prev) => prev.map((p) => (p.id === id ? post : p)));
      toast.success('حُفظ التعديل');
    } catch (e) {
      toast.error('تعذر الحفظ', errorMessage(e));
    }
  }
  async function removePost(id: string) {
    try {
      await api(`/api/posts/${id}`, { method: 'DELETE' });
      setLiked((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      toast.error('تعذر الحذف', errorMessage(e));
    }
  }

  const byKind = (k: RuleKind) => rules.filter((r) => r.kind === k);

  return (
    <div className="page">
      <div className="page-head fade-up">
        <div>
          <div className="eyebrow">التدريب</div>
          <h1>علّم بصمة ذوقك</h1>
          <p>كل ما تضيفه هنا يدخل مباشرة في تعليمات التوليد وفي استخلاص ملف أسلوبك</p>
        </div>
      </div>
      <div className="tabs mb-3 fade-up">
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            <Icon name={t.icon} size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'refs' && <ReferenceSection posts={liked} onAdd={addReference} onPatch={patchPost} onRemove={removePost} />}
      {tab === 'golden' && <RuleSection icon="zap" tone="" title="القواعد الذهبية" subtitle="أعلى أولوية: تظهر أول تعليمات كل توليد" placeholder="مثل: ابدأ دائماً بسؤال مباشر" rules={byKind('golden')} onAdd={(t) => addRule('golden', t)} onPatch={patchRule} onRemove={removeRule} />}
      {tab === 'avoid' && <RuleSection icon="x" tone="danger" title="أنماط مرفوضة" subtitle="يتجنبها بصمة في كل بوست. تُضاف تلقائياً عند رفض بوست" placeholder="مثل: نبرة وعظية، إحصائيات بدون مصدر" rules={byKind('avoid')} onAdd={(t) => addRule('avoid', t)} onPatch={patchRule} onRemove={removeRule} />}
      {tab === 'images' && (
        <div className="stack">
          <RuleSection icon="palette" tone="violet" title="ستايل الصور المفضل" subtitle="يُحقن في كل برومبت صورة. يُضاف تلقائياً عند الإعجاب بصورة" placeholder="مثل: ألوان دافئة، خلفية نظيفة، عنوان واحد كبير" rules={byKind('image_style')} onAdd={(t) => addRule('image_style', t)} onPatch={patchRule} onRemove={removeRule} />
          <RuleSection icon="x" tone="danger" title="ستايل الصور المرفوض" subtitle="يتجنبه بصمة في الصور. يُضاف تلقائياً عند رفض صورة" placeholder="مثل: صور واقعية، نصوص صغيرة كثيرة" rules={byKind('image_avoid')} onAdd={(t) => addRule('image_avoid', t)} onPatch={patchRule} onRemove={removeRule} />
        </div>
      )}
    </div>
  );
}

function RuleSection({ icon, tone, title, subtitle, placeholder, rules, onAdd, onPatch, onRemove }: {
  icon: IconName;
  tone: '' | 'violet' | 'danger';
  title: string;
  subtitle: string;
  placeholder: string;
  rules: Rule[];
  onAdd: (text: string) => Promise<boolean>;
  onPatch: (id: number, patch: { text?: string; active?: boolean }) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function add() {
    if (!text.trim() || busy) return;
    setBusy(true);
    if (await onAdd(text.trim())) setText('');
    setBusy(false);
  }
  return (
    <section className="card fade-up">
      <div className="row between mb-2">
        <div className="row" style={{ gap: 10 }}>
          <span className={`icon-bubble ${tone}`} style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: tone ? undefined : 'var(--brand-soft)', color: tone ? undefined : 'var(--brand)' }}>
            <Icon name={icon} size={17} />
          </span>
          <div>
            <b>{title}</b>
            <div className="subtle">{subtitle}</div>
          </div>
        </div>
        <span className="pill">{rules.filter((r) => r.active).length} فعّالة</span>
      </div>
      <div className="input-row mb-2">
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} onKeyDown={(e) => e.key === 'Enter' && add()} maxLength={300} />
        <Button variant="primary" onClick={add} disabled={!text.trim()} loading={busy} icon="plus">أضف</Button>
      </div>
      {rules.length === 0 ? (
        <p className="subtle text-center" style={{ padding: 12 }}>لا توجد قواعد بعد</p>
      ) : (
        <div className="list">
          {rules.map((r) => (
            <div key={r.id} className={`list-item ${r.active ? '' : 'inactive'}`} style={{ alignItems: 'center' }}>
              <Switch on={r.active} onChange={(v) => onPatch(r.id, { active: v })} label={r.active ? 'تعطيل' : 'تفعيل'} />
              <span className="grow">
                {editing?.id === r.id ? (
                  <input className="input" value={editing.text} onChange={(e) => setEditing({ id: r.id, text: e.target.value })} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') { onPatch(r.id, { text: editing.text }); setEditing(null); } if (e.key === 'Escape') setEditing(null); }} onBlur={() => { if (editing.text.trim() && editing.text !== r.text) onPatch(r.id, { text: editing.text }); setEditing(null); }} />
                ) : (
                  <>
                    {r.text}
                    <span className="source-badge">{SOURCE_LABEL[r.source]}</span>
                  </>
                )}
              </span>
              <span className="actions">
                <IconButton icon="pencil" label="تعديل" size="sm" className="btn-ghost" onClick={() => setEditing({ id: r.id, text: r.text })} />
                <IconButton icon="trash" label="حذف" size="sm" className="btn-ghost" onClick={() => onRemove(r.id)} />
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ReferenceSection({ posts, onAdd, onPatch, onRemove }: {
  posts: Post[];
  onAdd: (content: string, topic: string, own: boolean) => Promise<boolean>;
  onPatch: (id: string, patch: { content?: string; topic?: string }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [content, setContent] = useState('');
  const [topic, setTopic] = useState('');
  const [own, setOwn] = useState(true);
  const [editing, setEditing] = useState<{ id: string; content: string; topic: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  async function add() {
    if (content.trim().length < 10 || busy) return;
    setBusy(true);
    if (await onAdd(content.trim(), topic.trim(), own)) {
      setContent('');
      setTopic('');
    }
    setBusy(false);
  }
  const visible = showAll ? posts : posts.slice(0, 8);
  return (
    <div className="stack">
      <section className="card fade-up">
        <div className="row" style={{ gap: 10, marginBottom: 14 }}>
          <span className="icon-bubble" style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--brand-soft)', color: 'var(--brand)' }}>
            <Icon name="file-text" size={17} />
          </span>
          <div>
            <b>أضف بوستاً يعجبك أسلوبه</b>
            <div className="subtle">يُستخدم كمثال في التوليد وفي استخلاص ملف أسلوبك</div>
          </div>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="الموضوع (اختياري)" maxLength={120} />
          <textarea className="textarea" value={content} onChange={(e) => setContent(e.target.value)} placeholder="الصق نص البوست هنا..." />
          <div className="row between">
            <label className="row" style={{ gap: 8, cursor: 'pointer', fontSize: 13.5 }}>
              <Switch on={own} onChange={setOwn} label="كتبته بنفسي" />
              {own ? 'كتبته بنفسي (أقوى إشارة لصوتي)' : 'بوست لغيري أحب أسلوبه'}
            </label>
            <Button variant="primary" onClick={add} disabled={content.trim().length < 10} loading={busy} icon="plus">أضف كمرجع</Button>
          </div>
        </div>
      </section>
      <section className="card fade-up">
        <div className="row between mb-2">
          <b>المراجع الحالية</b>
          <span className="pill">{posts.length}</span>
        </div>
        {posts.length === 0 ? (
          <EmptyState icon="file-text" title="لا مراجع بعد" text="قيّم بوستات بإعجاب أو أضف نصوصاً تحبها" />
        ) : (
          <div className="list">
            {visible.map((p) => (
              <div key={p.id} className="list-item">
                <span className="grow">
                  {editing?.id === p.id ? (
                    <div className="stack" style={{ gap: 8 }}>
                      <input className="input" value={editing.topic} onChange={(e) => setEditing({ ...editing, topic: e.target.value })} placeholder="الموضوع" />
                      <textarea className="textarea" value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
                      <div className="row end">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>إلغاء</Button>
                        <Button size="sm" variant="primary" onClick={() => { onPatch(p.id, { content: editing.content, topic: editing.topic }); setEditing(null); }} icon="check">حفظ</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row" style={{ gap: 6, marginBottom: 4 }}>
                        <b style={{ color: 'var(--brand)', fontSize: 13 }}>{p.topic || 'بدون موضوع'}</b>
                        <span className="source-badge">{KIND_LABEL[p.kind]}</span>
                      </div>
                      <div className="subtle" style={{ color: 'var(--text-2)', whiteSpace: 'pre-line' }}>{p.content.slice(0, 160)}{p.content.length > 160 ? '…' : ''}</div>
                    </>
                  )}
                </span>
                {editing?.id !== p.id && (
                  <span className="actions">
                    <IconButton icon="pencil" label="تعديل" size="sm" className="btn-ghost" onClick={() => setEditing({ id: p.id, content: p.content, topic: p.topic })} />
                    <IconButton icon="trash" label="حذف" size="sm" className="btn-ghost" onClick={() => onRemove(p.id)} />
                  </span>
                )}
              </div>
            ))}
            {posts.length > 8 && (
              <Button variant="ghost" size="sm" onClick={() => setShowAll((s) => !s)} style={{ alignSelf: 'center' }}>
                {showAll ? 'عرض أقل' : `عرض الكل (${posts.length})`}
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
