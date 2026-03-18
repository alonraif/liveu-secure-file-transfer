# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat openssl

FROM base AS deps
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/config/package.json packages/config/package.json
RUN npm ci

FROM deps AS source
COPY . .

FROM source AS web-build
RUN npm run db:generate
RUN npm run build -w @liveu-sft/config
RUN npm run build -w @liveu-sft/web

FROM source AS worker-build
RUN npm run db:generate
RUN npm run build -w @liveu-sft/config
RUN npm run build -w @liveu-sft/worker

FROM source AS web-dev
EXPOSE 3000
CMD ["sh", "-lc", "mkdir -p apps/web/.next && find apps/web/.next -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true; npm run dev:web"]

FROM source AS worker-dev
EXPOSE 3100
CMD ["npm", "run", "dev:worker"]

FROM node:22-alpine AS web-prod
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S app && adduser -S app -G app && apk add --no-cache libc6-compat openssl
COPY --from=web-build /app/apps/web/.next/standalone ./
COPY --from=web-build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build /app/apps/web/public ./apps/web/public
COPY --from=web-build /app/prisma ./prisma
USER app
EXPOSE 3000
CMD ["node", "server.js"]

FROM node:22-alpine AS worker-prod
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=worker-build /app/apps/worker/dist ./apps/worker/dist
COPY --from=worker-build /app/packages/config/dist ./packages/config/dist
COPY --from=worker-build /app/package.json ./package.json
COPY --from=worker-build /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=worker-build /app/packages/config/package.json ./packages/config/package.json
COPY --from=worker-build /app/node_modules ./node_modules
USER app
EXPOSE 3100
CMD ["node", "apps/worker/dist/index.js"]
