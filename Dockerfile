# Production Image for Universal Database Migrator
# Optimized for ARM64 (Raspberry Pi) and x86_64

FROM node:20-slim AS base

# Install system dependencies for database operations
RUN apt-get update && apt-get install -y \
    postgresql-client \
    default-mysql-client \
    sqlite3 \
    curl \
    git \
    zip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Supabase CLI via direct binary (more reliable than npm in Docker)
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then SUPA_ARCH="amd64"; else SUPA_ARCH="arm64"; fi && \
    LATEST_TAG=$(curl -s "https://api.github.com/repos/supabase/cli/releases/latest" | sed -n 's/.*"tag_name": "\(.*\)".*/\1/p') && \
    VERSION=${LATEST_TAG#v} && \
    curl -L "https://github.com/supabase/cli/releases/download/${LATEST_TAG}/supabase_${VERSION}_linux_${SUPA_ARCH}.tar.gz" -o supabase.tar.gz && \
    tar -xzf supabase.tar.gz -C /usr/local/bin && \
    rm supabase.tar.gz && \
    chmod +x /usr/local/bin/supabase

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
