import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="center-screen">
      <div className="container" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🔍</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 16 }}>الصفحة غير موجودة</h2>
        <Link href="/" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>الرئيسية</Link>
      </div>
    </div>
  );
}
