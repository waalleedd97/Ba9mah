'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ImageRecord, SavedPost } from '@/lib/types';
import { api, errorMessage } from '@/lib/client/api';
import { ImageGrid } from './ImageGrid';
import { Button, EmptyState, Pill, PostPreview, useToast } from './ui';

export function SavedList({ initial, spec }: { initial: SavedPost[]; spec: string }) {
  const toast = useToast();
  const [items, setItems] = useState(initial);
  function patch(id: string, d: Partial<SavedPost>) {
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...d } : s)));
  }
  async function remove(id: string) {
    try {
      await api(`/api/saved/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((s) => s.id !== id));
      toast.info('حُذف من المحفوظات');
    } catch (e) {
      toast.error('تعذر الحذف', errorMessage(e));
    }
  }
  return (
    <div className="page page-narrow">
      <div className="page-head fade-up">
        <div>
          <div className="eyebrow">المحفوظات</div>
          <h1>بوستات جاهزة للنشر</h1>
          <p>{items.length ? `${items.length} بوست محفوظ` : 'ما فيه بوستات محفوظة بعد'}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState icon="bookmark" title="احفظ ما يعجبك" text="من شاشة التقييم اضغط احفظ، وسيظهر هنا مع صورته">
          <Link href="/" className="btn btn-primary">ولّد بوستات</Link>
        </EmptyState>
      ) : (
        <div className="stack" style={{ gap: 18 }}>
          {items.map((sp, i) => (
            <SavedCard key={sp.id} sp={sp} spec={spec} delay={i * 0.05} onPatch={(d) => patch(sp.id, d)} onRemove={() => remove(sp.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SavedCard({ sp, spec, delay, onPatch, onRemove }: { sp: SavedPost; spec: string; delay: number; onPatch: (d: Partial<SavedPost>) => void; onRemove: () => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [imgOpen, setImgOpen] = useState(Boolean(sp.imageId));

  async function saveEdit() {
    if (editing === null || !editing.trim()) return;
    try {
      const { saved } = await api<{ saved: SavedPost }>(`/api/saved/${sp.id}`, { method: 'PATCH', json: { content: editing } });
      onPatch({ content: saved.content });
      setEditing(null);
      toast.success('حُفظ التعديل');
    } catch (e) {
      toast.error('تعذر الحفظ', errorMessage(e));
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
      toast.success('تم التعديل', summary);
    } catch (e) {
      toast.error('تعذر التعديل', errorMessage(e));
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="card fade-up" style={{ animationDelay: `${delay}s` }}>
      {sp.topic && <div className="mb-1"><Pill tone="brand">{sp.topic}</Pill></div>}
      <PostPreview
        content={sp.content}
        subtitle={spec}
        editing={
          editing !== null ? (
            <div className="stack" style={{ gap: 8 }}>
              <textarea className="textarea" value={editing} onChange={(e) => setEditing(e.target.value)} autoFocus />
              <div className="row end">
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>إلغاء</Button>
                <Button size="sm" variant="primary" onClick={saveEdit} icon="check">حفظ</Button>
              </div>
            </div>
          ) : undefined
        }
      />
      {aiOpen && (
        <div className="input-row mt-2 fade-in">
          <input className="input" value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="وش تبي أعدل؟" onKeyDown={(e) => e.key === 'Enter' && aiEdit()} disabled={aiBusy} autoFocus />
          <Button variant="primary" onClick={aiEdit} disabled={!aiText.trim()} loading={aiBusy} icon="wand">عدّل</Button>
        </div>
      )}
      {imgOpen && (
        <div className="mt-2">
          <ImageGrid endpoint={`/api/saved/${sp.id}/images`} initialImages={sp.image ? [sp.image] : []} initialSelectedId={sp.imageId} onSelected={(img: ImageRecord) => onPatch({ imageId: img.id, image: img })} />
        </div>
      )}
      <div className="tool-row mt-2">
        <Button size="sm" icon="copy" onClick={() => navigator.clipboard.writeText(sp.content).then(() => toast.success('تم النسخ'))}>نسخ</Button>
        <Button size="sm" icon="pencil" onClick={() => { setEditing(sp.content); setAiOpen(false); }}>تعديل</Button>
        <Button size="sm" icon="wand" onClick={() => { setAiOpen((o) => !o); setEditing(null); }} className={aiOpen ? 'btn-success' : ''}>بالذكاء</Button>
        <Button size="sm" icon="image" onClick={() => setImgOpen((o) => !o)} className={imgOpen ? 'btn-success' : ''}>صورة</Button>
        <Button size="sm" icon="trash" variant="danger" onClick={onRemove} style={{ marginInlineStart: 'auto' }}>حذف</Button>
      </div>
    </div>
  );
}
