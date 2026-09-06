'use client';

import { useState } from 'react';
import type { Post, Rule, RuleKind } from '@/lib/types';
import { api, errorMessage } from '@/lib/client/api';
import { ErrorToast, SectionHeader, SuccessFlash, useFlash } from './ui';

const SOURCE_LABEL: Record<Rule['source'], string> = { onboarding: 'إعداد أولي', manual: 'يدوي', learned: 'متعلَّم', imported: 'مستورد' };
const KIND_LABEL: Record<Post['kind'], string> = { seed: 'مثال أولي', reference: 'مرجع', generated: 'مولّد', imported: 'مستورد' };

interface Props {
  rules: Rule[];
  liked: Post[];
}

export function TrainPanel({ rules: initialRules, liked: initialLiked }: Props) {
  const [rules, setRules] = useState(initialRules);
  const [liked, setLiked] = useState(initialLiked);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useFlash();

  async function addRule(kind: RuleKind, text: string, okMsg: string) {
    try {
      const { rule } = await api<{ rule: Rule }>('/api/rules', { method: 'POST', json: { kind, text } });
      setRules((prev) => [...prev, rule]);
      setFlash(okMsg);
      return true;
    } catch (e) {
      setErr(errorMessage(e));
      return false;
    }
  }

  async function patchRule(id: number, patch: { text?: string; active?: boolean }) {
    try {
      const { rule } = await api<{ rule: Rule }>(`/api/rules/${id}`, { method: 'PATCH', json: patch });
      setRules((prev) => prev.map((r) => (r.id === id ? rule : r)));
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function removeRule(id: number) {
    try {
      await api(`/api/rules/${id}`, { method: 'DELETE' });
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function addReference(content: string, topic: string) {
    try {
      const { post } = await api<{ post: Post }>('/api/posts', { method: 'POST', json: { content, topic: topic || undefined } });
      setLiked((prev) => [post, ...prev]);
      setFlash('تم إضافة البوست كمرجع — بصمة بيقلّد أسلوبه');
      return true;
    } catch (e) {
      setErr(errorMessage(e));
      return false;
    }
  }

  async function patchPost(id: string, patch: { content?: string; topic?: string }) {
    try {
      const { post } = await api<{ post: Post }>(`/api/posts/${id}`, { method: 'PATCH', json: patch });
      setLiked((prev) => prev.map((p) => (p.id === id ? post : p)));
      setFlash('تم حفظ التعديل');
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function removePost(id: string) {
    try {
      await api(`/api/posts/${id}`, { method: 'DELETE' });
      setLiked((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  const byKind = (k: RuleKind) => rules.filter((r) => r.kind === k);

  return (
    <div className="page">
      <div className="container">
        <div className="page-head fade-in">
          <div className="emoji">🎓</div>
          <h1>تدريب بصمة</h1>
          <p>أضف بوستات وقواعد يتعلم منها بصمة ويحسّن مخرجاته</p>
        </div>
        <ErrorToast message={err} onClose={() => setErr('')} />
        <SuccessFlash message={flash} />

        <ReferenceSection posts={liked} onAdd={addReference} onPatch={patchPost} onRemove={removePost} />

        <RuleSection icon="⭐" color="gold" title="القواعد الذهبية" subtitle="أعلى أولوية — تظهر أول التعليمات في كل توليد" placeholder="مثل: استخدم لهجة سعودية بيضاء" rules={byKind('golden')} onAdd={(t) => addRule('golden', t, 'تم إضافة القاعدة الذهبية')} onPatch={patchRule} onRemove={removeRule} />
        <RuleSection icon="🚫" color="red" title="أنماط مرفوضة" subtitle="يتجنبها بصمة في كل البوستات القادمة — تُضاف تلقائياً عند رفض بوست" placeholder="مثل: نبرة وعظية، بوستات طويلة مملة" rules={byKind('avoid')} onAdd={(t) => addRule('avoid', t, 'تم إضافة النمط المرفوض')} onPatch={patchRule} onRemove={removeRule} />
        <RuleSection icon="🎨" color="purple" title="ستايل الصور المفضل" subtitle="تُحقن في برومبت توليد الصور — تُضاف تلقائياً عند الإعجاب بصورة" placeholder="مثل: ألوان دافئة، خلفية نظيفة" rules={byKind('image_style')} onAdd={(t) => addRule('image_style', t, 'تم إضافة ستايل الصور')} onPatch={patchRule} onRemove={removeRule} />
        <RuleSection icon="🙅" color="red" title="ستايل الصور المرفوض" subtitle="يتجنبه بصمة في الصور — يُضاف تلقائياً عند رفض صورة" placeholder="مثل: صور واقعية، نصوص صغيرة كثيرة" rules={byKind('image_avoid')} onAdd={(t) => addRule('image_avoid', t, 'تم إضافة النمط المرفوض للصور')} onPatch={patchRule} onRemove={removeRule} />
      </div>
    </div>
  );
}

function RuleSection({ icon, color, title, subtitle, placeholder, rules, onAdd, onPatch, onRemove }: {
  icon: string;
  color: string;
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
    <div className="train-section">
      <div className="card" style={{ padding: 22 }}>
        <SectionHeader icon={icon} color={color} title={title} subtitle={subtitle} />
        <div className="train-input-row">
          <input className="input-field" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className="train-add-btn" disabled={!text.trim() || busy} onClick={add}>+</button>
        </div>
        {rules.length > 0 && (
          <div className="memory-items">
            {rules.map((r) => {
              const isEditing = editing?.id === r.id;
              return (
                <div key={r.id} className={`memory-item ${isEditing ? 'editing' : ''} ${r.active ? '' : 'inactive'}`}>
                  {isEditing ? (
                    <div className="memory-edit-form">
                      <input className="input-field memory-edit-input" value={editing.text} onChange={(e) => setEditing({ id: r.id, text: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && (onPatch(r.id, { text: editing.text }), setEditing(null))} />
                      <div className="memory-edit-actions">
                        <button className="memory-edit-save" onClick={() => { onPatch(r.id, { text: editing.text }); setEditing(null); }}>حفظ</button>
                        <button className="memory-edit-cancel" onClick={() => setEditing(null)}>إلغاء</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="memory-item-text">
                        <span style={{ color: `var(--${color})` }}>{icon}</span> {r.text}
                        <span className="source-badge">{SOURCE_LABEL[r.source]}</span>
                      </div>
                      <div className="memory-item-actions">
                        <button className="memory-item-edit" title={r.active ? 'تعطيل' : 'تفعيل'} onClick={() => onPatch(r.id, { active: !r.active })}>{r.active ? '⏸' : '▶'}</button>
                        <button className="memory-item-edit" title="تعديل" onClick={() => setEditing({ id: r.id, text: r.text })}>✎</button>
                        <button className="memory-item-delete" title="حذف" onClick={() => onRemove(r.id)}>✕</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ReferenceSection({ posts, onAdd, onPatch, onRemove }: {
  posts: Post[];
  onAdd: (content: string, topic: string) => Promise<boolean>;
  onPatch: (id: string, patch: { content?: string; topic?: string }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [content, setContent] = useState('');
  const [topic, setTopic] = useState('');
  const [editing, setEditing] = useState<{ id: string; content: string; topic: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (content.trim().length < 10 || busy) return;
    setBusy(true);
    if (await onAdd(content.trim(), topic.trim())) {
      setContent('');
      setTopic('');
    }
    setBusy(false);
  }

  const visible = showAll ? posts : posts.slice(0, 6);

  return (
    <div className="train-section">
      <div className="card" style={{ padding: 22 }}>
        <SectionHeader icon="📝" color="cyan" title="بوستات مرجعية" subtitle="كل بوست أعجبك أو أضفته هنا يُستخدم كمثال في التوليد وفي استخلاص ملف أسلوبك" />
        <input className="input-field" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="الموضوع (اختياري)" style={{ marginBottom: 10 }} />
        <textarea className="textarea-field" value={content} onChange={(e) => setContent(e.target.value)} placeholder="الصق نص بوست يعجبك أسلوبه..." />
        <div className="row end" style={{ marginTop: 10 }}>
          <button className="train-add-btn" disabled={content.trim().length < 10 || busy} onClick={add}>+ أضف كمرجع</button>
        </div>
        {posts.length > 0 && (
          <div className="memory-items">
            <div className="note" style={{ marginBottom: 4 }}>المراجع ({posts.length})</div>
            {visible.map((p) => {
              const isEditing = editing?.id === p.id;
              return (
                <div key={p.id} className={`memory-item ${isEditing ? 'editing' : ''}`}>
                  {isEditing ? (
                    <div className="memory-edit-form">
                      <input className="input-field memory-edit-input" value={editing.topic} onChange={(e) => setEditing({ ...editing, topic: e.target.value })} placeholder="الموضوع" />
                      <textarea className="textarea-field memory-edit-textarea" value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
                      <div className="memory-edit-actions">
                        <button className="memory-edit-save" onClick={() => { onPatch(p.id, { content: editing.content, topic: editing.topic }); setEditing(null); }}>حفظ</button>
                        <button className="memory-edit-cancel" onClick={() => setEditing(null)}>إلغاء</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="memory-item-text">
                        <span style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>{p.topic || 'بدون موضوع'}</span>
                        <span className="source-badge">{KIND_LABEL[p.kind]}</span>
                        <br />
                        {p.content.slice(0, 140)}{p.content.length > 140 ? '...' : ''}
                      </div>
                      <div className="memory-item-actions">
                        <button className="memory-item-edit" title="تعديل" onClick={() => setEditing({ id: p.id, content: p.content, topic: p.topic })}>✎</button>
                        <button className="memory-item-delete" title="حذف" onClick={() => onRemove(p.id)}>✕</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
            {posts.length > 6 && (
              <button className="btn-small" style={{ alignSelf: 'center' }} onClick={() => setShowAll((s) => !s)}>{showAll ? 'أقل' : `عرض الكل (${posts.length})`}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
