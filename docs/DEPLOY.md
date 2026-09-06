# نشر بصمة على سيرفر Hetzner

الهدف: نسخة مستقرة تعمل 24/7 بـ Docker، بياناتها على قرص دائم، خلف HTTPS.

## الطريق السريع: أمر واحد

على سيرفر Ubuntu أو Debian جديد أو موجود:

```bash
curl -fsSL https://raw.githubusercontent.com/waalleedd97/Ba9mah/main/scripts/deploy-hetzner.sh -o deploy.sh
sudo bash deploy.sh --password 'كلمة-مرور-قوية' --anthropic-key sk-ant-... --gemini-key AIza... --domain basma.example.com
```

السكربت يثبّت Docker إن لزم، يستنسخ المستودع في `/opt/basma`، يكتب `.env` ويولّد `AUTH_SECRET`، يفتح المنافذ، يشغّل الحاويات مع Caddy للـ HTTPS (احذف `--domain` لو عندك reverse proxy)، ويتحقق من الصحة. للتحديث لاحقاً شغّله بدون معاملات.

لسيرفر Hetzner جديد تماماً: الصق `deploy/cloud-init.yaml` في خانة Cloud config عند الإنشاء.

الخطوات اليدوية التفصيلية أدناه لمن يفضّلها.

## 1) المتطلبات

- سيرفر Ubuntu 22.04 أو 24.04 (أصغر باقة CX/CAX تكفي).
- دومين أو subdomain يشير إلى IP السيرفر (اختياري لكنه ضروري للـ HTTPS).
- مفتاحا Anthropic و Gemini.

## 2) تثبيت Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # ثم أعد تسجيل الدخول
docker compose version
```

## 3) جلب المشروع وضبط البيئة

```bash
git clone https://github.com/waalleedd97/Ba9mah.git basma
cd basma
cp .env.example .env
nano .env
```

في `.env` عدّل على الأقل:

```
APP_PASSWORD=كلمة-مرور-قوية
AUTH_SECRET=$(openssl rand -hex 32)   # انسخ الناتج الفعلي هنا
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
```

## 4) التشغيل

```bash
docker compose up -d --build
docker compose logs -f basma        # انتظر: Ready in ...
curl -s http://127.0.0.1:3000/api/health
```

التطبيق الآن على المنفذ 3000 **محلياً فقط** (لا يُفتح للإنترنت مباشرة).

## 5) HTTPS

### الخيار أ: Caddy المرفق (الأسهل)

```bash
sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
export BASMA_DOMAIN=basma.example.com
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d --build
```

خلال دقيقة تحصل على شهادة تلقائية ويصبح التطبيق على `https://basma.example.com`.
أضف `BASMA_DOMAIN` إلى ملف `.env` كي لا تحتاج تصديره كل مرة.

### الخيار ب: reverse proxy موجود عندك

لو تستخدم Nginx Proxy Manager أو Traefik أو Coolify فوجّهه إلى `127.0.0.1:3000` (أو إلى الحاوية `basma:3000` داخل نفس الشبكة). تأكد أن البروكسي يمرر ترويسة `X-Forwarded-Proto: https` حتى يُضبط كوكي الجلسة كـ Secure.

**Coolify**: أنشئ تطبيقاً من هذا المستودع بنوع Dockerfile، أضف volume على `/data`، وأدخل متغيرات `.env` في لوحة التطبيق. المنفذ 3000.

## 6) التحديث

```bash
cd ~/basma
git pull
docker compose up -d --build          # أو مع ملف caddy إن كنت تستخدمه
```

الـ migrations تُطبَّق تلقائياً عند الإقلاع، والبيانات محفوظة في volume باسم `basma_basma-data`.

## 7) النسخ الاحتياطي والاستعادة

```bash
# نسخة
docker run --rm -v basma_basma-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/basma-$(date +%F).tar.gz -C /data .

# استعادة (أوقف التطبيق أولاً)
docker compose stop basma
docker run --rm -v basma_basma-data:/data -v "$PWD":/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/basma-2026-01-01.tar.gz -C /data"
docker compose start basma
```

يكفي cron يومي بالأمر الأول مع نقل الملف خارج السيرفر.

## 8) الأوامر اليومية

```bash
docker compose logs -f --tail 200 basma   # السجلات (تشمل تصحيحات نظام العمل والتعلم)
docker compose restart basma
docker compose ps
```

## 9) مشاكل شائعة

| العرض | السبب والحل |
|---|---|
| صفحة الدخول تعيد تحميل نفسها بعد كلمة المرور الصحيحة | البروكسي لا يمرر `X-Forwarded-Proto` أو تفتح الموقع بـ http عبر بروكسي https. أصلح الترويسة أو ادخل عبر https |
| `APP_PASSWORD غير مضبوط` أو `AUTH_SECRET ... أقصر من 32` | راجع `.env` ثم `docker compose up -d` |
| `مفتاح ANTHROPIC_API_KEY غير صالح` | المفتاح خاطئ أو الحساب بلا رصيد |
| `نموذج الصور ... غير متاح لحسابك` | غيّر `GEMINI_IMAGE_MODEL` إلى نموذج متاح لحسابك (مثل `gemini-2.5-flash-image`) |
| بطء أول توليد | طبيعي: الجولة الأولى تبني الكاش، والتحقق القانوني يضيف ثوانٍ لبوستات الموارد البشرية |

## 10) نقل بيانات النسخة القديمة

في النسخة القديمة (المتصفح): `copy(localStorage.getItem('basma-memory'))` من console، ثم في النسخة الجديدة: الإعدادات ← استيراد ← الصق ← استيراد.
