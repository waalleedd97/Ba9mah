# بصمة — دليل العمل لجلسات Claude Code

مولّد محتوى LinkedIn بالعربية يتعلم أسلوب صاحبه من نصوصه وتقييماته. مستخدم واحد. Next.js 16 (App Router) + SQLite (better-sqlite3) + Gemini فقط. كل النصوص في الواجهة والوثائق والرسائل بالعربية.

## البيئة الإنتاجية (Hetzner)

- السيرفر: `root@167.233.196.52` (Ubuntu). استخدم SSH بمفتاح؛ الأوامر عبر `ssh root@167.233.196.52 '...'`.
- إذا كانت الجلسة تعمل على السيرفر نفسه (المضيف `njd-services-prod`، المستخدم root) فنفّذ الأوامر مباشرة بلا SSH. نسخة العمل هناك هي `/opt/basma` على فرع `main`؛ لا تعدّل فيها يدوياً، والنشر يسحب `main` من GitHub.
- المسار: `/opt/basma` — Docker Compose + Caddy (HTTPS تلقائي). الدومين: https://basma.njd-services.net
- **النشر والتحديث** (يسحب `main` ويعيد البناء ويحافظ على `.env` والبيانات):
  `sudo bash /opt/basma/scripts/deploy-hetzner.sh`
- تغيير المفتاح أو الدومين أو كلمة المرور: نفس السكربت مع `--gemini-key X` أو `--domain X` أو `--password X`.
- السجلات: `docker compose -f /opt/basma/docker-compose.yml logs -f basma`
- البيانات (قاعدة SQLite + الصور) في volume مربوط بـ `/data` داخل الحاوية. لا تحذفه ولا تعيد إنشاءه.
- الإصدار الحالي يظهر أسفل الشريط الجانبي وفي `/api/health`.

## سير العمل

1. الفرع الرئيسي `main`. اعمل على فرع، افتح PR، ادمجه، ثم انشر بالسكربت أعلاه.
2. قبل أي push: `npm run typecheck && npm run lint && npm run build`.
3. اختبار API كامل بوضع الاختبار على قاعدة فارغة: التعليمات في رأس `scripts/smoke.py` (يحتاج `BASMA_MOCK_AI=1` وقاعدة جديدة).
4. لا تكتب مفاتيح أو كلمات مرور في المستودع أو في الرسائل الملتزمة. المفاتيح في `.env` على السيرفر فقط.
5. لا تغيّر هيكل قاعدة البيانات إلا عبر migration جديدة في `src/lib/db/migrations.ts`.

## التطوير المحلي

```bash
npm install
cp .env.example .env   # اضبط APP_PASSWORD و AUTH_SECRET (openssl rand -hex 32)؛ بدون مفتاح ضع BASMA_MOCK_AI=1
npm run dev            # http://localhost:3000
```

Node 22 أو أحدث. الإنتاج يُبنى بـ `output: 'standalone'` داخل Docker.

## بنية الكود

- `src/app/(app)/` الصفحات بعد الدخول (الرئيسية، الجولة، التدريب، الاستوديو، المحفوظات، ملف الأسلوب، الإعدادات). `src/app/(setup)/onboarding` الإعداد الأولي بلا الشريط الجانبي. `src/app/login`. `src/app/api/*` المسارات.
- `src/lib/ai/gemini.ts` النداء الموحد: مخرجات JSON مطابقة لمخططات zod، مستوى تفكير لكل مسار، انتقال تلقائي لنموذج بديل عند 503/429/404. `generate.ts` الجولة، `learn.ts` ملف الأسلوب، `analyze.ts` تحليل الرفض والصور، `edit.ts`، `labor-law.ts` التحقق من نظام العمل، `prompts.ts`، `schemas.ts`، `mock.ts` نتائج وضع الاختبار.
- `src/lib/images/` الإخراج الفني ثم 4 أنماط صور من Gemini، التخزين على القرص.
- `src/lib/db/` الاتصال والترحيلات و`repo/` الاستعلامات. `src/lib/env.ts` كل متغيرات البيئة.
- `src/lib/auth/` كلمة مرور واحدة + كوكي موقّع؛ `src/proxy.ts` الحارس.
- `src/components/` الواجهة (`ui.tsx` النظام البصري، `icons.tsx`، `shell/` الشريط الجانبي والتنبيهات).
- `scripts/deploy-hetzner.sh` النشر، `scripts/smoke.py` الاختبار، `docs/DEPLOY.md` الدليل.

## قرارات ثابتة

- Gemini هو المزوّد الوحيد. النموذج الافتراضي `gemini-3-flash-preview` والبدائل `gemini-3.7-flash,gemini-3.1-flash-lite` (متغيرات `GEMINI_TEXT_MODEL` و`GEMINI_TEXT_FALLBACKS`). الصور `gemini-3.1-flash-image` وتتطلب فوترة مفعّلة في مشروع Google.
- نصوص المستخدم (kind = `own`) هي المرجع الأول للأسلوب؛ تُستورد بالجملة من صفحة التدريب أو الإعداد الأولي.
- عدّادات "أعجبك/رفضته" لا تحسب نصوص المستخدم.
- التواريخ تُعرض ميلادية بتوقيت الرياض بشكل حتمي (تفادياً لأخطاء hydration).
- ESLint يعمل بقواعد React Compiler: لا استدعاءات غير نقية أثناء التصيير ولا setState داخل useEffect.
- في `@google/genai`: `httpOptions.timeout` بالميلي ثانية لكن `retryOptions.initialDelay/maxDelay` بالثواني. تمرير 1000/6000 يعني انتظار 16 إلى 100 دقيقة بين المحاولات (حدث فعلاً في الإنتاج: نداء تعلم استغرق 31 دقيقة). لكل نموذج سقف زمني `MODEL_DEADLINE_MS` في `gemini.ts` عبر `abortSignal`، وبعده ننتقل للنموذج البديل.
- المفتاح على الحصة المجانية: `gemini-3-flash-preview` و`gemini-3.7-flash` يرجعان 429 بسرعة عند الضغط، والسلسلة تنزل إلى `gemini-3.1-flash-lite`. راقب `events` في القاعدة لمعرفة أي نموذج خدم فعلاً.
- التعلم يستقبل إحصاءات محسوبة من نصوص المستخدم (`corpusStats` في `prompts.ts`) والتوليد يستقبل وصف الشكل البصري منها؛ لا تحذفها فالنموذج يبالغ في الطول والقوائم بدونها.
- الحصة المجانية لمفتاح Gemini: بعض النماذج (مثل `gemini-3.8-flash`) محدودة بـ 20 طلباً يومياً لكل نموذج، والبحث في Google (`tools: googleSearch`) يرجع 429 على كل النماذج بلا فوترة. `news.ts` يجرّب البحث ثم يكمل بلا بحث مع ملاحظة للمستخدم؛ لا تجعل البحث شرطاً.
- جولة الخبر: `POST /api/rounds` مع `news: { text?, image? }` → `researchNews` (يقرأ الروابط من الصفحة مباشرة، ثم Gemini بنص حر عبر `textCall` لأن أدوات البحث لا تعمل مع مخرجات JSON) → `generateRound(headline, brief)`؛ الملخص والمصادر في `rounds.news_json`.
- أمر حر: `command: string` → `researchCommand` (Gemini يفهم الأمر: المواضيع، هل يحتاج بحثاً، كم بوست 1 إلى 4، القيود، ثم يبحث في Google إن لزم ويعيد مادة) → `generateRound` بعدد البوستات المطلوب؛ `NewsBrief.command/count`.
- آخر أخبار موضوع: `newsSearch: { query }` → `searchLatestNews` يجمع من خلاصات RSS بلا مفاتيح (Bing News بالعربية والإنجليزية وGoogle News بالعربية، آخر 45 يوماً، روابط Bing تحمل الرابط الحقيقي في المعامل `url`، وروابط Google News مشفّرة لا تُقرأ) ثم `researchTopic` يقرأ أهم 3 مقالات ويلخص التطورات بـ Gemini. في وضع الاختبار الخلاصات وهمية بلا شبكة.
- أسباب الرفض في `seed.ts` (`DISLIKE_REASON_OPTIONS`) متعددة الاختيار؛ سبب "نظام النقاط" يضيف قاعدة تجنب فوراً ويمنع `shapeTargets` من اقتراح شكل قائمة.
- تحليل الرفض (`analyze.ts`) يقيس على نصوص المستخدم نفسه (ثلاثة أمثلة + الإحصاءات + مفرداته) كي لا "يصحح" أسلوبه إلى كتابة عامة: حدث فعلاً أن أنتج قواعد تمنع الأسطر القصيرة وكلمة "قروشة" فانقلب التوليد كتلاً طويلة رفضها المستخدم. القواعد المتعلَّمة قصيرة، غير مكررة، سقفها 12 فعّالة، ويعيد التعلم صياغتها (`avoid_rules_consolidated`) في 8 كحد أقصى كلما بلغت 4. القواعد التي مصدرها `manual` و`onboarding` ثابتة لا تُمس.
