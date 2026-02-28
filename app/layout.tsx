import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'بصمة — صقل أسلوبك',
  description: 'أداة ذكية لتوليد محتوى LinkedIn يتعلم من ذوقك',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
