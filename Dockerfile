# syntax=docker/dockerfile:1

# ============================================================
#  بصمة — صورة Docker للإنتاج (Next.js 16 standalone)
#  البناء:   docker build -t basma .
#  التشغيل:  docker compose up -d
# ============================================================

FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# ---------- المرحلة 1: تثبيت المكتبات ----------
FROM base AS deps
# أدوات البناء احتياطاً لو لم تتوفر نسخة مسبقة البناء من better-sqlite3 لمعمارية السيرفر
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- المرحلة 2: البناء ----------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- المرحلة 3: التشغيل ----------
FROM base AS runner
WORKDIR /app
ENV PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --home /app basma \
 && mkdir -p /data \
 && chown -R basma:nodejs /data

COPY --from=builder --chown=basma:nodejs /app/public ./public
COPY --from=builder --chown=basma:nodejs /app/.next/standalone ./
COPY --from=builder --chown=basma:nodejs /app/.next/static ./.next/static

USER basma
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
