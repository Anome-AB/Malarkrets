FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* vars must be present at build time — Next.js inlines them into the client bundle.
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]

# Separate image for running Drizzle migrations. Used by the `migrate` service
# in docker-compose.prod.yml. Stays small by installing only prod deps (no
# Next.js build, no drizzle-kit — the migrator is the runtime one from
# drizzle-orm/postgres-js/migrator).
FROM node:22-alpine AS migrate
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src/db/migrations ./src/db/migrations
COPY scripts/migrate.mjs ./scripts/migrate.mjs
CMD ["node", "scripts/migrate.mjs"]

# On-demand seed image. Not started automatically — run manually with:
#   docker compose -f docker-compose.prod.yml run --rm seed
FROM node:22-alpine AS seed
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force
COPY src/db/schema.ts ./src/db/schema.ts
COPY src/db/seed.ts ./src/db/seed.ts
COPY tsconfig.json ./
CMD ["npx", "tsx", "src/db/seed.ts"]
