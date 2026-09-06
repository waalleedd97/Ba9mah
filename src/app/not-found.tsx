import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="hero">
      <div className="hero-inner text-center" style={{ maxWidth: 420 }}>
        <h1 className="hero-title" style={{ marginBottom: 10 }}>404</h1>
        <p className="muted mb-3">الصفحة غير موجودة</p>
        <Link href="/" className="btn btn-primary">الرئيسية</Link>
      </div>
    </div>
  );
}
