# Stage 1: Build
FROM node:20-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.2.0 --activate

WORKDIR /app

# Copy root workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./

# Copy workspace packages needed for build
COPY packages/bitcraft-bls/package.json packages/bitcraft-bls/
COPY packages/crosstown-sdk/package.json packages/crosstown-sdk/

# Install dependencies (frozen lockfile for reproducibility)
RUN pnpm install --frozen-lockfile --filter @sigil/bitcraft-bls...

# Copy source files
COPY packages/bitcraft-bls/ packages/bitcraft-bls/
COPY packages/crosstown-sdk/ packages/crosstown-sdk/

# Build
RUN pnpm --filter @sigil/bitcraft-bls build

# Stage 2: Production
FROM node:20-slim

ENV NODE_ENV=production
# Bind to all interfaces inside Docker (port access is controlled by Docker port mapping)
ENV BLS_BIND_HOST=0.0.0.0

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Run as non-root user (OWASP A05)
RUN groupadd --gid 1001 bls && useradd --uid 1001 --gid bls --shell /bin/sh --create-home bls

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.2.0 --activate

WORKDIR /app

# Copy root workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy built package and dependencies
COPY packages/bitcraft-bls/package.json packages/bitcraft-bls/
COPY packages/crosstown-sdk/package.json packages/crosstown-sdk/
COPY packages/crosstown-sdk/src/ packages/crosstown-sdk/src/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --filter @sigil/bitcraft-bls... --prod

# Copy built output
COPY --from=builder /app/packages/bitcraft-bls/dist/ packages/bitcraft-bls/dist/

# Switch to non-root user
USER bls

# Health check
HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=10s \
  CMD curl -f http://localhost:3001/health || exit 1

EXPOSE 3001

CMD ["node", "packages/bitcraft-bls/dist/index.js"]
