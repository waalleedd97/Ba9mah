'use client';

import { useState } from 'react';
import type { ImageRecord, StyleOption } from '@/lib/types';
import { api, errorMessage } from '@/lib/client/api';
import { ErrorToast } from './ui';

interface Slot {
  key: string;
  label: string;
  image: ImageRecord | null;
  loading: boolean;
  error: string | null;
}

export interface ImageGridProps {
  /** مثل /api/posts/{id}/images أو /api/saved/{id}/images */
  endpoint: string;
  initialImages: ImageRecord[];
  initialSelectedId: string | null;
  onSelected?: (img: ImageRecord) => void;
  onRated?: (img: ImageRecord) => void;
}

/**
 * شبكة الأنماط الأربعة: توليد متوازٍ، اختيار، تقييم، إعادة توليد.
 * تعمل للبوستات المولّدة وللمحفوظات (يختلف الـ endpoint فقط).
 */
export function ImageGrid({ endpoint, initialImages, initialSelectedId, onSelected, onRated }: ImageGridProps) {
  const [images, setImages] = useState<ImageRecord[]>(initialImages);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const selected = selectedId ? images.find((i) => i.id === selectedId) ?? null : null;

  async function startBatch() {
    if (busy) return;
    setBusy(true);
    setErr('');
    setSelectedId(null);
    try {
      const { styles } = await api<{ styles: StyleOption[] }>(endpoint);
      setSlots(styles.map((s) => ({ key: s.key, label: s.label, image: null, loading: true, error: null })));
      await Promise.all(styles.map((s) => generateSlot(s.key)));
    } catch (e) {
      setErr(errorMessage(e));
      setSlots([]);
    } finally {
      setBusy(false);
    }
  }

  async function generateSlot(styleKey: string) {
    setSlots((prev) => prev.map((s) => (s.key === styleKey ? { ...s, loading: true, error: null } : s)));
    try {
      const { image } = await api<{ image: ImageRecord }>(endpoint, { method: 'POST', json: { styleKey } });
      setImages((prev) => [...prev, image]);
      setSlots((prev) => prev.map((s) => (s.key === styleKey ? { ...s, image, loading: false } : s)));
    } catch (e) {
      setSlots((prev) => prev.map((s) => (s.key === styleKey ? { ...s, loading: false, error: errorMessage(e) } : s)));
    }
  }

  async function select(img: ImageRecord) {
    try {
      const { image } = await api<{ image: ImageRecord }>(`/api/images/${img.id}/select`, { method: 'POST' });
      setImages((prev) => prev.map((i) => (i.id === image.id ? image : i)));
      setSelectedId(image.id);
      setSlots([]);
      onSelected?.(image);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function rate(img: ImageRecord, liked: boolean) {
    try {
      const { image } = await api<{ image: ImageRecord }>(`/api/images/${img.id}/rate`, { method: 'POST', json: { liked } });
      setImages((prev) => prev.map((i) => (i.id === image.id ? image : i)));
      onRated?.(image);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  // 1) صورة مختارة
  if (selected) {
    return (
      <div className="fade-in" style={{ marginBottom: 20 }}>
        <ErrorToast message={err} onClose={() => setErr('')} />
        <div className="image-container selected-image">
          <img src={selected.url} alt={selected.headline ?? 'صورة البوست'} />
          <div className="image-actions">
            <button className="img-action-btn like" title="عجبتني الصورة" onClick={() => rate(selected, true)}>
              {selected.rating === 'liked' ? '💚' : '👍'}
            </button>
            <button className="img-action-btn dislike" title="ما عجبتني الصورة" onClick={() => rate(selected, false)}>
              {selected.rating === 'disliked' ? '💔' : '👎'}
            </button>
            <button className="img-action-btn refresh" title="4 صور جديدة" onClick={startBatch} disabled={busy}>
              {busy ? '⏳' : '🔄'}
            </button>
            <a className="img-action-btn refresh" title="تحميل" href={selected.url} download>
              ⬇️
            </a>
          </div>
          {selected.rating && (
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                padding: '6px 12px',
                borderRadius: 20,
                background: selected.rating === 'liked' ? 'rgba(0, 138, 5, 0.9)' : 'rgba(193, 53, 21, 0.9)',
                color: 'white',
                fontSize: 12,
                fontWeight: 700,
                animation: 'bounceIn 0.3s ease-out',
              }}
            >
              {selected.rating === 'liked' ? 'تعلّم منها ✓' : 'يحلل الصورة ويتحسن...'}
            </div>
          )}
        </div>
        {selected.styleLabel && (
          <div className="row" style={{ marginTop: 8 }}>
            <span className="pill">{selected.styleLabel}</span>
            {selected.headline && <span className="pill accent">«{selected.headline}»</span>}
          </div>
        )}
      </div>
    );
  }

  // 2) شبكة قيد التوليد أو جاهزة للاختيار
  const gridItems: Slot[] = slots.length
    ? slots
    : images.map((img) => ({ key: img.id, label: img.styleLabel ?? 'صورة', image: img, loading: false, error: null }));

  if (gridItems.length) {
    return (
      <div className="fade-in" style={{ marginBottom: 20 }}>
        <ErrorToast message={err} onClose={() => setErr('')} />
        <div className="row between" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>🎨 اختر الستايل المفضل</div>
          <button className="btn-small" onClick={startBatch} disabled={busy}>
            {busy ? '⏳ يولّد...' : '🔄 4 صور جديدة'}
          </button>
        </div>
        <div className="grid-2">
          {gridItems.map((item) => (
            <div key={item.key} className="image-grid-item">
              <div className="frame">
                {item.loading ? (
                  <span style={{ animation: 'spin 1.5s linear infinite', display: 'inline-block', fontSize: 28 }}>🎨</span>
                ) : item.image ? (
                  <img src={item.image.url} alt={item.label} />
                ) : (
                  <span className="note" style={{ padding: 10, textAlign: 'center' }}>فشل: {item.error}</span>
                )}
              </div>
              <div className="meta">
                <span>{item.label}</span>
                {item.image && !item.loading && (
                  <button className="memory-edit-save" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => select(item.image!)}>
                    اختر
                  </button>
                )}
                {!item.image && !item.loading && slots.length > 0 && (
                  <button className="btn-small" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => generateSlot(item.key)}>
                    أعد
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 3) لا صور بعد
  return (
    <div style={{ marginBottom: 20 }}>
      <ErrorToast message={err} onClose={() => setErr('')} />
      <button className="btn-generate-img" onClick={startBatch} disabled={busy}>
        {busy ? '⏳ يجهّز الإخراج الفني...' : '🎨 صمم صورة للبوست (4 ستايلات)'}
      </button>
    </div>
  );
}
