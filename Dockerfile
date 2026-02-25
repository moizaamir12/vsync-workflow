# ── Stage 1: builder ──────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

# Copy workspace structure files first for maximum layer caching.
# Dependencies are only re-installed when these files change.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy every package.json individually so Docker can cache the
# install layer as long as dependency declarations are unchanged.
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/config/package.json       packages/config/
COPY packages/blocks/package.json       packages/blocks/
COPY packages/db/package.json           packages/db/
COPY packages/auth/package.json         packages/auth/
COPY packages/engine/package.json       packages/engine/
COPY packages/engine-adapters/package.json packages/engine-adapters/
COPY packages/key-manager/package.json  packages/key-manager/
COPY packages/designer/package.json     packages/designer/
COPY packages/api/package.json          packages/api/
COPY tooling/typescript/package.json    tooling/typescript/
COPY tooling/vitest/package.json        tooling/vitest/
COPY tooling/eslint/package.json        tooling/eslint/

RUN pnpm install --frozen-lockfile

# Copy full source for packages the API depends on
COPY packages/ packages/
COPY tooling/  tooling/

# Build the API and all its transitive workspace dependencies
RUN pnpm turbo build --filter=@vsync/api...

# Create a pruned production-only deployment
RUN pnpm deploy --filter=@vsync/api --prod /app/deployed


# ── Stage 2: runner ──────────────────────────────────────────
FROM node:22-alpine AS runner

# dumb-init: proper PID 1 signal forwarding (SIGTERM for graceful shutdown)
# curl: used by HEALTHCHECK
RUN apk add --no-cache dumb-init curl

WORKDIR /app

# Copy the pruned node_modules and package metadata
COPY --from=builder /app/deployed ./

# Copy compiled dist/ from every package the API imports at runtime
COPY --from=builder /app/packages/api/dist              packages/api/dist
COPY --from=builder /app/packages/shared-types/dist     packages/shared-types/dist
COPY --from=builder /app/packages/config/dist           packages/config/dist
COPY --from=builder /app/packages/blocks/dist           packages/blocks/dist
COPY --from=builder /app/packages/db/dist               packages/db/dist
COPY --from=builder /app/packages/auth/dist             packages/auth/dist
COPY --from=builder /app/packages/engine/dist           packages/engine/dist
COPY --from=builder /app/packages/engine-adapters/dist  packages/engine-adapters/dist
COPY --from=builder /app/packages/key-manager/dist      packages/key-manager/dist
COPY --from=builder /app/packages/designer/dist         packages/designer/dist

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/api/v1/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "packages/api/dist/server.js"]
