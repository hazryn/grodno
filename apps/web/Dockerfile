# Rodno web (Nuxt 3) — build w monorepo pnpm. Kontekst budowania = root repo.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml .npmrc package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Instaluj tylko web + jego zależności (czyli też @rodno/shared).
RUN pnpm install --frozen-lockfile --filter "@rodno/web..."

# shared musi być zbudowany przed buildem Nuxta (web importuje @rodno/shared).
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN pnpm --filter @rodno/shared build && pnpm --filter @rodno/web build

# ── runtime ── Nuxt .output jest self-contained.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5200
COPY --from=build /app/apps/web/.output ./.output
EXPOSE 5200
CMD ["node", ".output/server/index.mjs"]
