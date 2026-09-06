'use client';

import { useState } from 'react';
import type { ImageRecord } from '@/lib/types';
import { api, errorMessage, fileToDataUrl } from '@/lib/client/api';
import { ErrorToast, Icon3D } from './ui';

export function Studio({ initialImages, styleRuleCount }: { initialImages: ImageRecord[]; styleRuleCount: number }) {
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [prompt, setPrompt] = useState('');
  const [upload, setUpload] = useState<string | null>(null);
  const [images, setImages] = useState(initialImages);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function generate() {
    if (!prompt.trim() || busy) return;
    if (mode === 'edit' && !upload) return;
    setBusy(true);
    setErr('');
    try {
      const { image } = await api<{ image: ImageRecord }>('/api/studio', { method: 'POST', json: { prompt: prompt.trim(), image: mode === 'edit' ? upload : undefined } });
      setImages((prev) => [image, ...prev]);
      setPrompt('');
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/images/${id}`, { method: 'DELETE' });
      setImages((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      setErr('الصورة أكبر من 8 ميغابايت');
      return;
    }
    setUpload(await fileToDataUrl(f));
  }

  return (
    <div className="page">
      <div className="container">
        <div className="page-head fade-in">
          <div className="emoji">🎨</div>
          <h1>استوديو الصور</h1>
          <p>ولّد صور بالذكاء الاصطناعي أو عدّل على صور موجودة — تُحفظ كلها هنا</p>
        </div>

        <div className="studio-toggle">
          <button className={`studio-toggle-btn ${mode === 'create' ? 'active' : ''}`} onClick={() => setMode('create')}>توليد جديد</button>
          <button className={`studio-toggle-btn ${mode === 'edit' ? 'active' : ''}`} onClick={() => setMode('edit')}>تعديل صورة</button>
        </div>

        <div className="card fade-in" style={{ padding: 22, marginBottom: 20 }}>
          <div className="row" style={{ marginBottom: 14 }}>
            <Icon3D color={mode === 'create' ? 'accent' : 'cyan'}>{mode === 'create' ? '✨' : '✏️'}</Icon3D>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>{mode === 'create' ? 'توليد صورة جديدة' : 'تعديل صورة موجودة'}</h3>
              <p className="note">{mode === 'create' ? 'اوصف الصورة اللي تبيها' : 'ارفع صورة وقل وش تبي تعدل فيها'}</p>
            </div>
          </div>

          {mode === 'edit' &&
            (!upload ? (
              <div className="studio-upload-area" onClick={() => document.getElementById('studio-file')?.click()}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                <div>اضغط لرفع صورة</div>
                <div className="note">PNG, JPG, WEBP — حتى 8MB</div>
              </div>
            ) : (
              <div className="studio-preview">
                <img src={upload} alt="الصورة المرفوعة" />
                <button className="studio-preview-remove" onClick={() => setUpload(null)} title="إزالة">✕</button>
              </div>
            ))}
          <input id="studio-file" type="file" accept="image/*" style={{ display: 'none' }} onChange={onFile} />

          <textarea
            className="textarea-field"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={mode === 'create' ? 'مثل: قطة كرتونية تشرب قهوة في مقهى، شعار لمشروع تقني...' : 'مثل: غيّر الخلفية لأزرق، أضف نص عربي، حوّلها لستايل كرتوني...'}
            style={{ marginBottom: 12, minHeight: 80 }}
          />
          {styleRuleCount > 0 && (
            <div className="note" style={{ marginBottom: 10 }}>
              <span className="tag purple" style={{ fontSize: 11, padding: '3px 10px' }}>ذكي</span> يطبق {styleRuleCount} قاعدة ستايل تعلّمها
            </div>
          )}
          <ErrorToast message={err} onClose={() => setErr('')} />
          <button className="btn-primary" disabled={!prompt.trim() || busy || (mode === 'edit' && !upload)} onClick={generate}>
            {busy ? <><span style={{ animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>🎨</span> يشتغل...</> : mode === 'create' ? '🎨 ولّد الصورة' : '✏️ عدّل الصورة'}
          </button>
        </div>

        {images.length > 0 && (
          <div className="fade-in-up">
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>📸 الصور ({images.length})</div>
            <div className="studio-gallery">
              {images.map((item) => (
                <div key={item.id} className="studio-gallery-item">
                  <img src={item.url} alt={item.prompt} />
                  <div className="studio-gallery-actions">
                    <a className="img-action-btn refresh" title="تحميل" href={item.url} download>⬇️</a>
                    <button className="img-action-btn dislike" title="حذف" onClick={() => remove(item.id)}>🗑️</button>
                  </div>
                  <div className="studio-gallery-caption">{item.prompt}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
