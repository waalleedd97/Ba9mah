'use client';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="center-screen">
      <div className="container fade-in" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>😵</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>صار خطأ غير متوقع</h2>
        <p className="note" style={{ marginBottom: 20 }}>{error.message}</p>
        <button className="btn-primary" onClick={reset}>حاول مرة ثانية</button>
      </div>
    </div>
  );
}
