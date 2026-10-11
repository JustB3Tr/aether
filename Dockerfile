FROM node:22-alpine
ARG AETHER_VERSION=5.5.0
LABEL org.opencontainers.image.version=$AETHER_VERSION
LABEL org.opencontainers.image.source="https://github.com/JustB3Tr/aether"
ENV NODE_ENV=production

RUN apk add --no-cache curl

WORKDIR /app

COPY package.json package-lock.json ./
COPY tools/patch-hammerhead-tls.mjs ./tools/patch-hammerhead-tls.mjs
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY public/ ./public/
COPY data/ ./data/
COPY security/ ./security/

RUN mkdir -p /app/userdata

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -sf http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
