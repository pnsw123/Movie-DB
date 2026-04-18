# ─── Stage 1: deps ────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# libc6-compat is required by some Node native modules on Alpine
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ─── Stage 2: build ───────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects telemetry by default; disable for cleaner CI logs.
ENV NEXT_TELEMETRY_DISABLED=1

# Public env vars must be available at BUILD time because Next inlines them.
# We'll pipe them through with --build-arg on fly deploy.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
