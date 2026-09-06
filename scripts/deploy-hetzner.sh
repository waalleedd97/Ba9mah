#!/usr/bin/env bash
# ============================================================
#  نشر / تحديث "بصمة" على سيرفر Ubuntu أو Debian بأمر واحد.
#
#  أول مرة (على السيرفر، كـ root أو مع sudo):
#    curl -fsSL https://raw.githubusercontent.com/waalleedd97/Ba9mah/main/scripts/deploy-hetzner.sh -o deploy.sh
#    sudo bash deploy.sh --password 'كلمة-مرور-قوية' \
#         --anthropic-key sk-ant-... --gemini-key AIza... \
#         [--domain basma.example.com] [--branch main] [--dir /opt/basma]
#
#  التحديث لاحقاً: sudo bash /opt/basma/scripts/deploy-hetzner.sh
#  (بدون معاملات: يسحب آخر إصدار ويعيد البناء ويحافظ على .env والبيانات)
# ============================================================
set -euo pipefail

REPO_URL="https://github.com/waalleedd97/Ba9mah.git"
APP_DIR="/opt/basma"
BRANCH="main"
DOMAIN=""
PASSWORD=""
ANTHROPIC_KEY=""
GEMINI_KEY=""
IMAGE_MODEL=""

usage() { sed -n '2,14p' "$0"; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --password) PASSWORD="$2"; shift 2 ;;
    --anthropic-key) ANTHROPIC_KEY="$2"; shift 2 ;;
    --gemini-key) GEMINI_KEY="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
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
[[ -n "$ANTHROPIC_KEY" ]] && set_env ANTHROPIC_API_KEY "$ANTHROPIC_KEY"
[[ -n "$GEMINI_KEY" ]] && set_env GEMINI_API_KEY "$GEMINI_KEY"
[[ -n "$IMAGE_MODEL" ]] && set_env GEMINI_IMAGE_MODEL "$IMAGE_MODEL"
[[ -n "$DOMAIN" ]] && set_env BASMA_DOMAIN "$DOMAIN"
set_env DATA_DIR /data

secret="$(get_env AUTH_SECRET)"
if [[ -z "$secret" || "$secret" == replace-with-* || ${#secret} -lt 32 ]]; then
  set_env AUTH_SECRET "$(openssl rand -hex 32)"
  log "وُلّد AUTH_SECRET جديد"
fi
[[ "$(get_env APP_PASSWORD)" != "change-me-now" && -n "$(get_env APP_PASSWORD)" ]] || die "اضبط كلمة المرور: --password '...'"
[[ "$(get_env ANTHROPIC_API_KEY)" != "sk-ant-xxxxx" && -n "$(get_env ANTHROPIC_API_KEY)" ]] || die "اضبط مفتاح Anthropic: --anthropic-key ..."
[[ "$(get_env GEMINI_API_KEY)" != "AIzaSyxxxxx" && -n "$(get_env GEMINI_API_KEY)" ]] || die "اضبط مفتاح Gemini: --gemini-key ..."
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
log "بناء الصورة وتشغيل الحاويات (قد يأخذ 3-5 دقائق أول مرة)"
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
log "تم النشر"
if [[ -n "$(get_env BASMA_DOMAIN)" ]]; then
  echo "الرابط: https://$(get_env BASMA_DOMAIN)   (الشهادة تُصدر خلال دقيقة إن كان الدومين يشير إلى $IP)"
else
  echo "التطبيق يستمع على 127.0.0.1:3000 فقط. وجّه الـ reverse proxy إليه، أو أعد التشغيل مع --domain لتفعيل HTTPS تلقائياً."
fi
echo "السجلات:  docker compose -f $APP_DIR/docker-compose.yml logs -f basma"
echo "التحديث:  sudo bash $APP_DIR/scripts/deploy-hetzner.sh"
