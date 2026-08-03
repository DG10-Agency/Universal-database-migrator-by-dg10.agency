# Production Image for Universal Database Migrator
# Optimized for ARM64 (Raspberry Pi) and x86_64

FROM node:20-bookworm AS base

# Install system dependencies for database operations
# Install PostgreSQL 17 client from official repo
RUN apt-get update && apt-get install -y curl ca-certificates gnupg lsb-release default-mysql-client sqlite3 git zip     && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/pgdg.gpg     && echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list     && apt-get update && apt-get install -y postgresql-client-17     && rm -rf /var/lib/apt/lists/*     && ln -sf /usr/lib/postgresql/17/bin/pg_dump /usr/local/bin/pg_dump     && ln -sf /usr/lib/postgresql/17/bin/pg_dumpall /usr/local/bin/pg_dumpall     && ln -sf /usr/lib/postgresql/17/bin/psql /usr/local/bin/psql     && pg_dump --version

# Install Supabase CLI via direct binary (more reliable than npm in Docker)
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then SUPA_ARCH="amd64"; else SUPA_ARCH="arm64"; fi && \
    set -ex && \
    curl -fsSL "https://github.com/supabase/cli/releases/latest/download/supabase_linux_${SUPA_ARCH}.tar.gz" -o supabase.tar.gz && \
    tar -xzf supabase.tar.gz -C /usr/local/bin && \
    rm supabase.tar.gz && \
    chmod +x /usr/local/bin/supabase && \
    supabase --version

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Build the application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next.js collects completely anonymous telemetry about general usage.
# Learn more here: https://nextjs.org/telemetry
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
