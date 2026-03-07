FROM node:22-slim AS base
LABEL org.opencontainers.image.source="https://github.com/ZealHua/openmemo"

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.4.0 --activate

FROM base AS builder
ARG BUILD_DATE
ARG VCS_REF

LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${VCS_REF}"

WORKDIR /app

# Optimally cache dependencies using pnpm fetch
COPY pnpm-lock.yaml ./
RUN pnpm fetch

# Copy workspace code and install (offline to force using fetched cache)
COPY . .
RUN pnpm install -r --offline --frozen-lockfile

# Build project
RUN pnpm build

FROM base AS installer
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl bash \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/client/dist ./apps/client/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/packages/editor-ext/dist ./packages/editor-ext/dist
COPY --from=builder /app/packages/editor-ext/package.json ./packages/editor-ext/package.json

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm*.yaml ./
COPY --from=builder /app/.npmrc ./
COPY --from=builder /app/patches ./patches

RUN chown -R node:node /app
USER node

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

RUN mkdir -p /app/data/storage
VOLUME ["/app/data/storage"]
EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["pnpm", "start"]
