# LoMu web player + sync server, built for Coolify (Dockerfile build pack, base directory: web).
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=4100 \
    HOSTNAME=0.0.0.0 \
    LOMU_DATA_DIR=/data \
    LOMU_CACHE_DIR=/cache \
    LOMU_SECURE_COOKIES=1 \
    LOMU_REGION=IN
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
RUN mkdir -p /data /cache && chown -R node:node /data /cache /app
USER node
VOLUME ["/data"]
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4100/api/auth/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
