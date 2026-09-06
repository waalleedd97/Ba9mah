'use client';

import { useState } from 'react';
import type { ImageRecord } from '@/lib/types';
import { api, errorMessage, fileToDataUrl } from '@/lib/client/api';
import { Button, EmptyState, Pill, useToast } from './ui';
import { Icon } from './icons';

export function Studio({ initialImages, styleRuleCount }: { initialImages: ImageRecord[]; styleRuleCount: number }) {
  const toast = useToast();
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [prompt, setPrompt] = useState('');
  const [upload, setUpload] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [images, setImages] = useState(initialImages);
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (!prompt.trim() || busy || (mode === 'edit' && !upload)) return;
    setBusy(true);
    try {
      const { image } = await api<{ image: ImageRecord }>('/api/studio', { method: 'POST', json: { prompt: prompt.trim(), image: mode === 'edit' ? upload : undefined } });
      setImages((prev) => [image, ...prev]);
      setPrompt('');
      toast.success('جاهزة', 'الصورة محفوظة في المعرض');
    } catch (e) {
      toast.error('تعذر التوليد', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try {
      await api(`/api/images/${id}`, { method: 'DELETE' });
      setImages((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      toast.error('تعذر الحذف', errorMessage(e));
    }
  }
  async function pick(file?: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return toast.error('الصورة أكبر من 8 ميغابايت');
    if (!file.type.startsWith('image/')) return toast.error('الملف ليس صورة');
    setUpload(await fileToDataUrl(file));
  }

  return (
    <div className="page">
      <div className="page-head fade-up">
        <div>
          <div className="eyebrow">الاستوديو</div>
          <h1>صور بالذكاء الاصطناعي</h1>
          <p>ولّد صوراً حرة أو عدّل على صورك، وكلها تُحفظ هنا</p>
        </div>
        {styleRuleCount > 0 && <Pill tone="violet" icon="palette">يطبق {styleRuleCount} قاعدة ستايل تعلّمها</Pill>}
      </div>

      <section className="card card-lg mb-3 fade-up">
        <div className="tabs mb-2" style={{ maxWidth: 360 }}>
          <button className={`tab ${mode === 'create' ? 'active' : ''}`} onClick={() => setMode('create')}><Icon name="sparkles" size={15} /> توليد جديد</button>
          <button className={`tab ${mode === 'edit' ? 'active' : ''}`} onClick={() => setMode('edit')}><Icon name="pencil" size={15} /> تعديل صورة</button>
        </div>
        {mode === 'edit' &&
          (!upload ? (
            <div
              className={`upload-area mb-2 ${drag ? 'drag' : ''}`}
              onClick={() => document.getElementById('studio-file')?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
            >
              <Icon name="upload" size={28} style={{ marginBottom: 8 }} />
              <div><b>اسحب صورة هنا</b> أو اضغط للاختيار</div>
              <div className="subtle">PNG · JPG · WEBP حتى 8MB</div>
            </div>
          ) : (
            <div className="upload-preview mb-2">
              <img src={upload} alt="الصورة المرفوعة" />
              <button className="overlay-btn" style={{ position: 'absolute', top: 10, insetInlineEnd: 10 }} onClick={() => setUpload(null)} title="إزالة">
                <Icon name="x" size={16} />
              </button>
            </div>
          ))}
        <input id="studio-file" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pick(e.target.files?.[0])} />
        <textarea className="textarea" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={mode === 'create' ? 'اوصف الصورة: قطة كرتونية تشرب قهوة في مقهى، شعار لمشروع تقني...' : 'وش تبي تعدل؟ غيّر الخلفية لأزرق، أضف نص عربي، حوّلها لستايل كرتوني...'} style={{ minHeight: 90 }} />
        <div className="row end mt-2">
          <Button variant="primary" size="lg" onClick={generate} disabled={!prompt.trim() || (mode === 'edit' && !upload)} loading={busy} icon={mode === 'create' ? 'sparkles' : 'wand'}>
            {mode === 'create' ? 'ولّد الصورة' : 'عدّل الصورة'}
          </Button>
        </div>
      </section>

      {images.length === 0 ? (
        <EmptyState icon="image" title="المعرض فاضي" text="أول صورة تولّدها تظهر هنا" />
      ) : (
        <div className="gallery fade-up">
          {images.map((item) => (
            <div key={item.id} className="gallery-item">
              <img src={item.url} alt={item.prompt} />
              <div className="overlay-actions">
                <a className="overlay-btn" href={item.url} download title="تحميل"><Icon name="download" size={16} /></a>
                <button className="overlay-btn" onClick={() => remove(item.id)} title="حذف"><Icon name="trash" size={16} /></button>
              </div>
              <div className="cap">{item.prompt}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
