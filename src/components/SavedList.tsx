'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ImageRecord, SavedPost } from '@/lib/types';
import { api, errorMessage } from '@/lib/client/api';
import { ImageGrid } from './ImageGrid';
import { EmptyState, ErrorToast, SuccessFlash, useFlash } from './ui';

export function SavedList({ initial }: { initial: SavedPost[] }) {
  const [items, setItems] = useState(initial);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useFlash();

  function patch(id: string, data: Partial<SavedPost>) {
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
  }

  async function remove(id: string) {
    try {
      await api(`/api/saved/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  return (
    <div className="page">
      <div className="container">
        <div className="page-head fade-in">
          <div className="emoji">📌</div>
          <h1>البوستات المحفوظة</h1>
          <p>{items.length > 0 ? `${items.length} بوست محفوظ` : 'ما فيه بوستات محفوظة بعد'}</p>
        </div>
        <ErrorToast message={err} onClose={() => setErr('')} />
        <SuccessFlash message={flash} />
        {items.length === 0 ? (
          <EmptyState emoji="📋" text="احفظ البوستات اللي تعجبك من شاشة التقييم عشان ترجع لها بعدين">
            <Link href="/" className="btn-secondary" style={{ display: 'inline-block', textDecoration: 'none' }}>روح ولّد بوستات</Link>
          </EmptyState>
        ) : (
          <div className="stack" style={{ gap: 16 }}>
            {items.map((sp, i) => (
              <SavedCard key={sp.id} sp={sp} delay={i * 0.05} onPatch={(d) => patch(sp.id, d)} onRemove={() => remove(sp.id)} onError={setErr} onFlash={setFlash} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SavedCard({ sp, delay, onPatch, onRemove, onError, onFlash }: {
  sp: SavedPost;
  delay: number;
  onPatch: (d: Partial<SavedPost>) => void;
  onRemove: () => void;
  onError: (m: string) => void;
  onFlash: (m: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  async function saveEdit() {
    if (editing === null || !editing.trim()) return;
    try {
      const { saved } = await api<{ saved: SavedPost }>(`/api/saved/${sp.id}`, { method: 'PATCH', json: { content: editing } });
      onPatch({ content: saved.content });
      setEditing(null);
      onFlash('تم حفظ التعديل');
    } catch (e) {
      onError(errorMessage(e));
    }
  }

  async function aiEdit() {
    if (!aiText.trim() || aiBusy) return;
    setAiBusy(true);
    try {
      const { saved, summary } = await api<{ saved: SavedPost; summary: string }>(`/api/saved/${sp.id}/edit`, { method: 'POST', json: { instruction: aiText } });
      onPatch({ content: saved.content });
      setAiOpen(false);
      setAiText('');
      onFlash(summary || 'تم التعديل بالذكاء الاصطناعي');
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="saved-post-card fade-in" style={{ animationDelay: `${delay}s` }}>
      {sp.topic && <div className="topic-tag" style={{ marginBottom: 12 }}>📌 {sp.topic}</div>}
      {editing === null ? (
        <div className="post-body" style={{ marginBottom: 14 }}>{sp.content}</div>
      ) : (
        <div className="fade-in" style={{ marginBottom: 14 }}>
          <textarea className="textarea-field" value={editing} onChange={(e) => setEditing(e.target.value)} style={{ minHeight: 140 }} />
          <div className="row end" style={{ marginTop: 8 }}>
            <button className="memory-edit-save" onClick={saveEdit}>حفظ</button>
            <button className="memory-edit-cancel" onClick={() => setEditing(null)}>إلغاء</button>
          </div>
        </div>
      )}
      {aiOpen && (
        <div className="fade-in post-edit-row" style={{ marginBottom: 14 }}>
          <input className="input-field post-edit-input" value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="وش تبي أعدل؟ مثل: خله أقصر..." onKeyDown={(e) => e.key === 'Enter' && aiEdit()} disabled={aiBusy} />
          <button className="post-edit-btn" disabled={!aiText.trim() || aiBusy} onClick={aiEdit}>{aiBusy ? '⏳' : '🤖'}</button>
        </div>
      )}

      <ImageGrid endpoint={`/api/saved/${sp.id}/images`} initialImages={sp.image ? [sp.image] : []} initialSelectedId={sp.imageId} onSelected={(img: ImageRecord) => onPatch({ imageId: img.id, image: img })} />

      <div className="saved-post-actions">
        <button className="saved-post-copy" onClick={() => navigator.clipboard.writeText(sp.content).then(() => onFlash('تم نسخ البوست'))}>📋 نسخ النص</button>
        <button className="saved-post-copy" onClick={() => { setEditing(sp.content); setAiOpen(false); }}>✏️ تعديل</button>
        <button className="saved-post-copy" onClick={() => { setAiOpen((o) => !o); setEditing(null); }}>🤖 عدّل بالذكاء</button>
        <button className="saved-post-remove" onClick={onRemove}>🗑️ حذف</button>
      </div>
    </div>
  );
}
