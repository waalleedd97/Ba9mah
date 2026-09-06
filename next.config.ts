import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // مخرجات مستقلة للـ Docker: server.js + الحد الأدنى من node_modules
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // better-sqlite3 وحدة native — لا تُحزَّم مع Turbopack بل تُحمَّل من node_modules وقت التشغيل
  serverExternalPackages: ['better-sqlite3'],
  images: {
    // الصور تُقدَّم من مسار API خاص بنا بعد التحقق من الجلسة، فلا حاجة لمحسّن الصور
    unoptimized: true,
  },
};

export default nextConfig;
