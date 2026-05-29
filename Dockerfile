ARG NODE_IMAGE=node:22-bookworm-slim
ARG NEXT_PUBLIC_BASE_PATH=""

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV HTTP_PROXY="" HTTPS_PROXY="" ALL_PROXY="" http_proxy="" https_proxy="" all_proxy="" NO_PROXY="*" no_proxy="*"
COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com \
 && npm ci --no-audit --no-fund

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV HTTP_PROXY="" HTTPS_PROXY="" ALL_PROXY="" http_proxy="" https_proxy="" all_proxy="" NO_PROXY="*" no_proxy="*"
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ARG NEXT_PUBLIC_BASE_PATH
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx --yes prisma generate
RUN npm run build
RUN npm prune --omit=dev

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV HTTP_PROXY="" HTTPS_PROXY="" ALL_PROXY="" http_proxy="" https_proxy="" all_proxy="" NO_PROXY="*" no_proxy="*"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/lib/generated ./lib/generated
COPY --from=builder /app/scripts ./scripts

RUN mkdir -p /app/public/generated

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -H 0.0.0.0 -p 3000"]
