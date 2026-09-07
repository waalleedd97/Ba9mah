# بصمة — دليل العمل لجلسات Claude Code

مولّد محتوى LinkedIn بالعربية يتعلم أسلوب صاحبه من نصوصه وتقييماته. مستخدم واحد. Next.js 16 (App Router) + SQLite (better-sqlite3) + Gemini فقط. كل النصوص في الواجهة والوثائق والرسائل بالعربية.

## البيئة الإنتاجية (Hetzner)

- السيرفر: `root@167.233.196.52` (Ubuntu). استخدم SSH بمفتاح؛ الأوامر عبر `ssh root@167.233.196.52 '...'`.
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
