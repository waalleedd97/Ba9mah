'use client';

import { Button } from '@/components/ui';
import { Icon } from '@/components/icons';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="hero">
      <div className="hero-inner text-center" style={{ maxWidth: 480 }}>
        <div className="icon-bubble danger" style={{ width: 64, height: 64, borderRadius: 20, margin: '0 auto 16px', display: 'grid', placeItems: 'center' }}>
          <Icon name="alert" size={30} />
        </div>
        <h2 style={{ fontSize: 24, marginBottom: 8 }}>صار خطأ غير متوقع</h2>
        <p className="muted mb-3">{error.message}</p>
        <Button variant="primary" onClick={reset} icon="refresh">حاول مرة ثانية</Button>
      </div>
    </div>
  );
}
