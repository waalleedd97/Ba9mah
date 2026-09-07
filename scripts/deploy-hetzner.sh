#!/usr/bin/env bash
# ============================================================
#  نشر / تحديث "بصمة" على سيرفر Ubuntu أو Debian بأمر واحد.
#
#  أول مرة (على السيرفر، كـ root أو مع sudo):
#    curl -fsSL https://raw.githubusercontent.com/waalleedd97/Ba9mah/main/scripts/deploy-hetzner.sh -o deploy.sh
#    sudo bash deploy.sh --password 'كلمة-مرور-قوية' \
#         [--gemini-key المفتاح] \
#         [--domain basma.example.com | --no-domain] [--branch main] [--dir /opt/basma]
#    (مفتاح Gemini يشغّل الكتابة والتعلم والصور. بدونه يعمل التطبيق بوضع الاختبار حتى تضيفه لاحقاً بنفس الأمر)
#
#  التحديث لاحقاً: sudo bash /opt/basma/scripts/deploy-hetzner.sh
#  (بدون معاملات: يسحب آخر إصدار ويعيد البناء ويحافظ على .env والبيانات)
# ============================================================
set -euo pipefail

REPO_URL="https://github.com/waalleedd97/Ba9mah.git"
APP_DIR="/opt/basma"
BRANCH="main"
DOMAIN=""
NO_DOMAIN=0
PASSWORD=""
GEMINI_KEY=""
IMAGE_MODEL=""

usage() { sed -n '2,14p' "$0"; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --password) PASSWORD="$2"; shift 2 ;;
    --gemini-key) GEMINI_KEY="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    --no-domain) NO_DOMAIN=1; shift ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --dir) APP_DIR="$2"; shift 2 ;;
    --image-model) IMAGE_MODEL="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "معامل غير معروف: $1"; usage ;;
  esac
done

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mخطأ: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "شغّل السكربت بـ sudo أو كـ root"

# قيم نموذجية منسوخة من التعليمات كما هي؟
is_placeholder() { [[ -z "$1" || "$1" == *"..."* || "$1" == *xxxxx* || "$1" == "كلمة-مرور-قوية" || "$1" == "change-me-now" || "$1" == *example.com* ]]; }
[[ -n "$PASSWORD" ]] && is_placeholder "$PASSWORD" && die "بدّل 'كلمة-مرور-قوية' بكلمة مرور حقيقية"
[[ -n "$GEMINI_KEY" ]] && { is_placeholder "$GEMINI_KEY" || [[ ${#GEMINI_KEY} -lt 30 ]]; } && die "مفتاح Gemini غير صالح: انسخه كاملاً من aistudio.google.com/apikey"
[[ -n "$DOMAIN" ]] && { is_placeholder "$DOMAIN" || [[ "$DOMAIN" != *.* ]]; } && die "الدومين غير صالح: استخدم دومينك الحقيقي الموجّه إلى هذا السيرفر، أو --no-domain"

# ---------- 1) Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  log "تثبيت Docker"
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || die "docker compose غير متوفر. ثبّت docker-compose-plugin"
systemctl enable --now docker >/dev/null 2>&1 || true

# ---------- 2) الكود ----------
if [[ -d "$APP_DIR/.git" ]]; then
  log "تحديث الكود في $APP_DIR (فرع $BRANCH)"
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  git -C "$APP_DIR" checkout --quiet "$BRANCH"
  git -C "$APP_DIR" pull --quiet --ff-only origin "$BRANCH"
else
  log "استنساخ المستودع إلى $APP_DIR (فرع $BRANCH)"
  command -v git >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq git; }
  git clone --quiet --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# ---------- 3) ملف .env ----------
[[ -f .env ]] || { cp .env.example .env; log "أُنشئ .env من المثال"; }

set_env() { # KEY VALUE — يعدّل السطر أو يضيفه
  local key="$1" val="$2"
  if grep -qE "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    printf '%s=%s\n' "$key" "$val" >> .env
  fi
}
get_env() { grep -E "^$1=" .env | head -1 | cut -d= -f2- || true; }

[[ -n "$PASSWORD" ]] && set_env APP_PASSWORD "$PASSWORD"
[[ -n "$GEMINI_KEY" ]] && set_env GEMINI_API_KEY "$GEMINI_KEY"
# إعدادات Claude القديمة لم تعد مستخدمة
sed -i "/^ANTHROPIC_API_KEY=/d; /^CLAUDE_MODEL=/d" .env
[[ -n "$IMAGE_MODEL" ]] && set_env GEMINI_IMAGE_MODEL "$IMAGE_MODEL"
[[ -n "$DOMAIN" ]] && set_env BASMA_DOMAIN "$DOMAIN"
if [[ $NO_DOMAIN -eq 1 ]]; then
  sed -i '/^BASMA_DOMAIN=/d' .env
  docker rm -f basma-caddy >/dev/null 2>&1 || true
  log "أُزيل الدومين وأُوقف Caddy؛ التطبيق على 127.0.0.1:3000 فقط"
fi
set_env DATA_DIR /data

secret="$(get_env AUTH_SECRET)"
if [[ -z "$secret" || "$secret" == replace-with-* || ${#secret} -lt 32 ]]; then
  set_env AUTH_SECRET "$(openssl rand -hex 32)"
  log "وُلّد AUTH_SECRET جديد"
fi
is_placeholder "$(get_env APP_PASSWORD)" && die "كلمة المرور في .env قيمة نموذجية. شغّل مع: --password 'كلمتك'"
# مفتاح Gemini يشغّل كل شيء (الكتابة والتعلم والصور). بدونه يعمل التطبيق بوضع الاختبار (نتائج وهمية) حتى يُضاف
g="$(get_env GEMINI_API_KEY)"
KEYS_OK=1
{ is_placeholder "$g" || [[ ${#g} -lt 30 ]]; } && KEYS_OK=0
if [[ $KEYS_OK -eq 1 ]]; then
  set_env BASMA_MOCK_AI 0
else
  set_env BASMA_MOCK_AI 1
  printf '\n\033[1;33mتنبيه: مفتاح Gemini غير مضبوط بعد. التطبيق سيعمل بوضع الاختبار (بوستات وصور وهمية)\nحتى تعيد تشغيل السكربت مع --gemini-key المفتاح\033[0m\n'
fi
d="$(get_env BASMA_DOMAIN)"; [[ -n "$d" ]] && is_placeholder "$d" && die "الدومين في .env قيمة نموذجية. شغّل مع --domain دومينك أو --no-domain"
chmod 600 .env

# ---------- 4) الجدار الناري (إن وُجد ufw) ----------
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp >/dev/null 2>&1 || true
  if [[ -n "$(get_env BASMA_DOMAIN)" ]]; then
    ufw allow 80/tcp >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
  fi
fi

# ---------- 5) التشغيل ----------
COMPOSE=(docker compose -f docker-compose.yml)
[[ -n "$(get_env BASMA_DOMAIN)" ]] && COMPOSE+=(-f docker-compose.caddy.yml)
export GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo dev)"
export BUILD_DATE="$(date -u +%Y-%m-%dT%H:%MZ)"
log "بناء الإصدار $GIT_SHA وتشغيل الحاويات (قد يأخذ 3-5 دقائق أول مرة)"
"${COMPOSE[@]}" up -d --build --remove-orphans

# ---------- 6) فحص الصحة ----------
log "انتظار التطبيق"
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "التطبيق يعمل بعد ${i} ثانية"
    break
  fi
  sleep 2
  [[ $i -eq 60 ]] && { docker compose logs --tail 50 basma; die "التطبيق لم يستجب. راجع السجلات أعلاه"; }
done

docker image prune -f >/dev/null 2>&1 || true

IP="$(curl -s -m 5 https://api.ipify.org || hostname -I | awk '{print $1}')"
log "تم النشر — الإصدار $GIT_SHA"
if [[ -n "$(get_env BASMA_DOMAIN)" ]]; then
  echo "الرابط: https://$(get_env BASMA_DOMAIN)   (الشهادة تُصدر خلال دقيقة إن كان الدومين يشير إلى $IP)"
else
  echo "التطبيق يستمع على 127.0.0.1:3000 فقط. وجّه الـ reverse proxy إليه، أو أعد التشغيل مع --domain لتفعيل HTTPS تلقائياً."
fi
[[ $KEYS_OK -eq 1 ]] || echo "وضع الاختبار مفعّل (بدون مفتاح Gemini). للتفعيل: sudo bash $APP_DIR/scripts/deploy-hetzner.sh --gemini-key المفتاح"
echo "السجلات:  docker compose -f $APP_DIR/docker-compose.yml logs -f basma"
echo "التحديث:  sudo bash $APP_DIR/scripts/deploy-hetzner.sh"
