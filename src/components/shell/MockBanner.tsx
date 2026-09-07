import Link from 'next/link';
import { Icon } from '@/components/icons';

/** شريط ظاهر في كل الصفحات عندما يعمل التطبيق بلا مفتاح Claude */
export function MockBanner() {
  return (
    <div className="mock-banner" role="status">
      <Icon name="alert" size={16} />
      <span>
        <b>وضع الاختبار:</b> النصوص والصور هنا وهمية. الذكاء الاصطناعي لم يبدأ الكتابة بعد لأن مفتاح Claude غير مضبوط على السيرفر.
      </span>
      <Link href="/settings" className="mock-banner-link">كيف أفعّله؟</Link>
    </div>
  );
}
