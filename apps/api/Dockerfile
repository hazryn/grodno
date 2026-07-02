# Rodno API — build w monorepo pnpm. Kontekst budowania = root repo.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

# Manifesty najpierw (cache warstw). Wszystkie pakiety workspace muszą być obecne
# dla --frozen-lockfile, nawet jeśli instalujemy tylko podzbiór (--filter).
COPY pnpm-workspace.yaml pnpm-lock.yaml .npmrc package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Instaluj tylko api + jego zależności (czyli też @rodno/shared).
RUN pnpm install --frozen-lockfile --filter "@rodno/api..."

# Źródła i build (shared → api).
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @rodno/shared build && pnpm --filter @rodno/api build

# ── runtime ──
FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
COPY apps/api/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
WORKDIR /app/apps/api
EXPOSE 5201
ENTRYPOINT ["/entrypoint.sh"]

# ── dev ── nest start --watch (auto-restart przy zmianie). Migracje odpalą się przy
# starcie (DB_RUN_MIGRATIONS=true). Źródło bind-mountowane; node_modules z obrazu.
# GEDCOM-seed pomijany (dane trwają w wolumenie Postgresa) — na świeżą bazę zrób import ręcznie.
FROM node:22-alpine AS dev
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml .npmrc package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --filter "@rodno/api..."
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @rodno/shared build
ENV NODE_ENV=development
EXPOSE 5201
CMD ["sh", "-c", "pnpm --filter @rodno/shared build && pnpm --filter @rodno/api dev"]
