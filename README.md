# 🎯 بصمة — Basma

أداة ذكية لتوليد محتوى LinkedIn تتعلم من ذوقك باستخدام **التعلم بالسياق (In-Context Learning)**

## المميزات

- **5 أسئلة A/B ذكية** لبناء بروفايل الذوق الأولي
- **Claude API** لتوليد بوستات جديدة كل مرة
- **Nano Banana (Gemini)** لتوليد صور احترافية لكل بوست
- **Dynamic Few-Shot Prompting** — يحقن آخر 5 بوستات عجبتك في كل طلب
- **Negative Constraints** — يحلل أسباب الرفض تلقائياً ويتجنبها
- **Temperature تكيفي** — كل ما زادت إعجاباتك، التزم أكثر بأسلوبك
- **ذاكرة دائمة** عبر localStorage

## التشغيل

### 1. تثبيت المكتبات

```bash
cd basma
npm install
```

### 2. إعداد مفاتيح API

```bash
cp .env.local.example .env.local
```

عدّل `.env.local` وأضف مفاتيحك:

```
ANTHROPIC_API_KEY=sk-ant-xxxxx
GEMINI_API_KEY=AIzaSyxxxxx
```

**من وين تحصل المفاتيح؟**
- **Anthropic Claude**: https://console.anthropic.com/
- **Google Gemini**: https://aistudio.google.com/apikey

### 3. التشغيل

```bash
npm run dev
```

افتح المتصفح على `http://localhost:3000`

## البنية التقنية

```
basma/
├── app/
│   ├── api/
│   │   ├── generate-posts/   → Claude API — توليد 4 بوستات بالسياق
│   │   ├── generate-image/   → Gemini Nano Banana — توليد صور
│   │   └── analyze-dislike/  → Claude API — تحليل سبب الرفض
│   ├── lib/
│   │   └── data.ts           → الذاكرة + البيانات الأولية + الأنواع
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx              → الواجهة الرئيسية (كل المراحل)
├── .env.local.example
├── next.config.js
├── package.json
└── README.md
```

## كيف يعمل التعلم بالسياق؟

```
[المستخدم يقيّم البوستات: 👍 / 👎]
         ↓
[الذاكرة تُحدَّث: بوستات ناجحة + أسباب رفض]
         ↓
[Prompt Builder يبني System Prompt ديناميكي]
         ↓
┌─────────────────────────────────────────┐
│ System Prompt يحتوي:                    │
│ ✦ القواعد الذهبية (من الـ onboarding)   │
│ ✦ آخر 5 بوستات عجبت المستخدم          │
│ ✦ آخر 3 بوستات ما عجبته               │
│ ✦ أسباب الرفض المكتشفة                │
│ ✦ قائمة "تجنب تماماً"                  │
└─────────────────────────────────────────┘
         ↓
[Claude يولد 4 بوستات جديدة ومختلفة]
         ↓
[المستخدم يضغط 🎨 → Nano Banana يولد صورة]
```

## الرخصة

MIT
