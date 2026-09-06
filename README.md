# 🫆 بصمة — Basma v2

مولّد محتوى LinkedIn بالعربية يتعلم ذوقك مع كل تقييم. نسخة 2 أُعيد بناؤها بالكامل: ذاكرة سحابية على سيرفرك، ملف أسلوب يُستخلص تلقائياً، وأحدث نماذج Claude و Gemini.

## ماذا يفعل؟

1. **إعداد أولي بلا كتابة**: مجالك من بطاقات، نصوص كتبتها بنفسك تُستخلص منها بصمتك فوراً، وسمات صوتك وما تكرهه في بوستات LinkedIn بلمسات.
2. **جولات**: كل جولة 4 بوستات، بعضها ملتزم بأسلوبك وبعضها استكشافي ليتعلم النظام حدود ذوقك.
3. **تقييم**: 👍 / 👎 لكل بوست مع سبب الرفض بلمسة، تعديل يدوي أو بالذكاء الاصطناعي، حفظ، وتوليد صورة بأربعة أنماط.
4. **تعلم**: كل رفض يُحلَّل إلى قاعدة تجنب، وكل 3 تقييمات يُعاد استخلاص **ملف الأسلوب** الذي يقود التوليد القادم. الصور تتعلم أيضاً: الإعجاب والرفض يُحلَّلان بالرؤية من الصورة نفسها.
5. **تحقق قانوني**: بوستات الموارد البشرية تُراجَع تلقائياً ضد نص نظام العمل السعودي.

## البنية التقنية

| الطبقة | التقنية |
|---|---|
| الإطار | Next.js 16 (App Router, Turbopack, `proxy.ts`) + React 19 + TypeScript |
| الكتابة والتعلم والتحليل | Claude Opus 5 عبر `@anthropic-ai/sdk` بمخرجات منظّمة (zod) وتفكير تكيفي و prompt caching |
| الصور | Gemini `gemini-3.1-flash-image` (Nano Banana 2) عبر `@google/genai`، قابل للتبديل |
| التخزين | SQLite (`better-sqlite3`) + ملفات الصور على القرص في `DATA_DIR` |
| الدخول | كلمة مرور واحدة، جلسة موقّعة HMAC في كوكي HttpOnly، حماية من تكرار المحاولات |
| النشر | Docker (standalone) + docker compose، اختيارياً Caddy للـ HTTPS |

```
src/
├── app/
│   ├── (app)/            الصفحات المحمية: الرئيسية، onboarding، round/[id]، train، studio، saved، profile، settings
│   ├── api/              25 مساراً: auth, rounds, posts, images, studio, rules, saved, profile, import, reset, health
│   ├── login/
│   └── layout.tsx, globals.css
├── components/           المكوّنات التفاعلية (RatingFlow, ImageGrid, Dashboard, TrainPanel, Studio, ...)
├── lib/
│   ├── ai/               anthropic.ts (النداء الموحد), generate, learn, analyze, edit, labor-law, prompts, schemas
│   ├── images/           gemini.ts, pipeline.ts (إخراج فني + 4 أنماط), storage.ts, styles.ts
│   ├── db/               الاتصال + migrations مضمّنة + repo/*
│   ├── auth/             session.ts, rate-limit.ts
│   └── env.ts, types.ts, seed.ts, text.ts, stats.ts, import-legacy.ts
└── proxy.ts              حارس الجلسة لكل المسارات
```

## التشغيل محلياً

```bash
npm install
cp .env.example .env      # عبّئ APP_PASSWORD و AUTH_SECRET والمفاتيح
npm run dev               # http://localhost:3000
```

بدون مفاتيح؟ ضع `BASMA_MOCK_AI=1` في `.env` وسيعمل كل شيء بنتائج وهمية.

| متغير | الوصف |
|---|---|
| `APP_PASSWORD` | كلمة مرور الدخول |
| `AUTH_SECRET` | 64 حرفاً hex لتوقيع الجلسة: `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | مفتاح Claude |
| `GEMINI_API_KEY` | مفتاح Gemini |
| `CLAUDE_MODEL` | افتراضياً `claude-opus-5` |
| `GEMINI_IMAGE_MODEL` | افتراضياً `gemini-3.1-flash-image`، وللجودة الأعلى `gemini-3-pro-image-preview` |
| `LABOR_LAW_CHECK` | `auto` (افتراضي) أو `always` أو `off` |
| `DATA_DIR` | مجلد قاعدة البيانات والصور، افتراضياً `./data` وفي Docker `/data` |

أوامر مفيدة: `npm run typecheck`، `npm run lint`، `npm run build`.

## كيف يتعلم بصمة؟

```
تقييم 👍/👎  ──►  رفض؟ تحليل السبب ──► قاعدة تجنب متعلَّمة
      │
      └──► كل 3 تقييمات: استخلاص ملف الأسلوب (نبرة، بنية، طول، افتتاحيات، مفردات، ممنوعات)
                          │
التوليد القادم = [قواعد ثابتة] + [ملف الأسلوب + القواعد الذهبية + التجنب] (cache) + [6 أمثلة متنوعة + مرفوضات + مواضيع حديثة]
                          │
                          └── N بوست ملتزم + M استكشافي (M يقل مع تراكم الإعجابات ويبقى 1 كل ثالث جولة)
```

- **نصوصك أنت** هي المرجع الأول للصوت، ثم **التعديل اليدوي** قبل الإعجاب: تُحفظ النسختان ويقارنهما التعلم.
- **الكتابة البشرية**: تعليمات صريحة ضد العبارات الجاهزة والقوالب والحماس المصطنع، مع 9 أشكال (قصة، رأي مخالف، ملاحظة، اعتراف بخطأ...) ينوّع بينها.
- **الصور**: الإخراج الفني (عنوان عربي + وصف لكل نمط) من Claude، ثم 4 صور متوازية من Gemini. الإعجاب أو الرفض يُحلَّل بالرؤية ويتحول لقاعدة ستايل.
- **الأنماط** تُرتَّب حسب ما تختاره فعلاً بعد 6 اختيارات.

## النشر على السيرفر

انظر [docs/DEPLOY.md](docs/DEPLOY.md) لخطوات النشر على Hetzner (Docker + Caddy)، التحديث، والنسخ الاحتياطي.

## الانتقال من النسخة القديمة

في النسخة القديمة افتح console المتصفح ونفّذ `copy(localStorage.getItem('basma-memory'))`، ثم في النسخة الجديدة: الإعدادات ← استيراد ← الصق. تُستورد القواعد والبوستات والمحفوظات مع صورها.

## الاختبار

`scripts/smoke.py` يفحص كل المسارات بوضع `BASMA_MOCK_AI=1` على قاعدة بيانات فارغة (التعليمات داخل الملف).

## الرخصة

MIT
