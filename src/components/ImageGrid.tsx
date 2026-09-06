'use client';

import { useState } from 'react';
import type { ImageRecord, StyleOption } from '@/lib/types';
import { api, errorMessage } from '@/lib/client/api';
import { Button, Pill, useToast } from './ui';
import { Icon } from './icons';

interface Slot {
  key: string;
  label: string;
  image: ImageRecord | null;
  loading: boolean;
  error: string | null;
}

export interface ImageGridProps {
  endpoint: string;
  initialImages: ImageRecord[];
  initialSelectedId: string | null;
  onSelected?: (img: ImageRecord) => void;
  onRated?: (img: ImageRecord) => void;
  compact?: boolean;
}

export function ImageGrid({ endpoint, initialImages, initialSelectedId, onSelected, onRated, compact }: ImageGridProps) {
  const toast = useToast();
  const [images, setImages] = useState<ImageRecord[]>(initialImages);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [busy, setBusy] = useState(false);
  const selected = selectedId ? images.find((i) => i.id === selectedId) ?? null : null;

  async function startBatch() {
    if (busy) return;
    setBusy(true);
    setSelectedId(null);
    try {
      const { styles } = await api<{ styles: StyleOption[] }>(endpoint);
      setSlots(styles.map((s) => ({ key: s.key, label: s.label, image: null, loading: true, error: null })));
      await Promise.all(styles.map((s) => generateSlot(s.key)));
    } catch (e) {
      toast.error('تعذر بدء توليد الصور', errorMessage(e));
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
      toast.success('تم اختيار الصورة', 'بصمة سجّل النمط الذي تفضله');
    } catch (e) {
      toast.error('تعذر اختيار الصورة', errorMessage(e));
    }
  }

  async function rate(img: ImageRecord, liked: boolean) {
    try {
      const { image } = await api<{ image: ImageRecord }>(`/api/images/${img.id}/rate`, { method: 'POST', json: { liked } });
      setImages((prev) => prev.map((i) => (i.id === image.id ? image : i)));
      onRated?.(image);
      toast.success(liked ? 'أعجبتك الصورة' : 'رفضت الصورة', liked ? 'يتعلم ما نجح فيها' : 'يحلل الصورة ليتجنب ما أزعجك');
    } catch (e) {
      toast.error('تعذر التقييم', errorMessage(e));
    }
  }

  if (selected) {
    return (
      <div className="fade-in">
        <div className="image-frame">
          <img src={selected.url} alt={selected.headline ?? 'صورة البوست'} />
          {selected.rating && <span className={`image-tag ${selected.rating}`}>{selected.rating === 'liked' ? 'أعجبتك · تعلّم منها' : 'رفضتها · يتحسن'}</span>}
          <div className="overlay-actions">
            <button className={`overlay-btn ${selected.rating === 'liked' ? 'on-like' : ''}`} title="عجبتني" onClick={() => rate(selected, true)}>
              <Icon name="thumbs-up" size={18} />
            </button>
            <button className={`overlay-btn ${selected.rating === 'disliked' ? 'on-dislike' : ''}`} title="ما عجبتني" onClick={() => rate(selected, false)}>
              <Icon name="thumbs-down" size={18} />
            </button>
            <button className="overlay-btn" title="4 صور جديدة" onClick={startBatch} disabled={busy}>
              <Icon name="refresh" size={18} />
            </button>
            <a className="overlay-btn" title="تحميل" href={selected.url} download>
              <Icon name="download" size={18} />
            </a>
          </div>
        </div>
        {(selected.styleLabel || selected.headline) && (
          <div className="row mt-1" style={{ gap: 6 }}>
            {selected.styleLabel && <Pill>{selected.styleLabel}</Pill>}
            {selected.headline && <Pill tone="brand">«{selected.headline}»</Pill>}
          </div>
        )}
      </div>
    );
  }

  const items: Slot[] = slots.length ? slots : images.map((img) => ({ key: img.id, label: img.styleLabel ?? 'صورة', image: img, loading: false, error: null }));

  if (items.length) {
    return (
      <div className="fade-in">
        <div className="row between mb-1">
          <b style={{ fontSize: 14 }}>اختر النمط الأقرب لذوقك</b>
          <Button size="sm" variant="ghost" onClick={startBatch} disabled={busy} icon="refresh">
            {busy ? 'يولّد...' : '4 صور جديدة'}
          </Button>
        </div>
        <div className="style-grid">
          {items.map((item) => (
            <div key={item.key} className="style-cell">
              <div className="frame">
                {item.loading ? (
                  <Icon name="loader" size={26} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-3)' }} />
                ) : item.image ? (
                  <img src={item.image.url} alt={item.label} />
                ) : (
                  <span className="subtle" style={{ padding: 12, textAlign: 'center' }}>{item.error ?? 'فشل'}</span>
                )}
              </div>
              <div className="meta">
                <span>{item.label}</span>
                {item.image && !item.loading && (
                  <button className="btn btn-primary btn-sm" style={{ padding: '4px 12px' }} onClick={() => select(item.image!)}>
                    اختر
                  </button>
                )}
                {!item.image && !item.loading && slots.length > 0 && (
                  <button className="btn btn-sm" style={{ padding: '4px 10px' }} onClick={() => generateSlot(item.key)}>
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

  return (
    <Button block={!compact} variant={compact ? 'default' : 'default'} onClick={startBatch} disabled={busy} icon="image" loading={busy} style={!compact ? { padding: 16, borderStyle: 'dashed' } : undefined}>
      {busy ? 'يجهّز الإخراج الفني...' : 'صمّم صورة بأربعة أنماط'}
    </Button>
  );
}
