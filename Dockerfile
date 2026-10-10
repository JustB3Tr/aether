FROM node:22-alpine
ARG AETHER_VERSION=5.1.0
LABEL org.opencontainers.image.version=$AETHER_VERSION
LABEL org.opencontainers.image.source="https://github.com/JustB3Tr/aether"

RUN apk add --no-cache curl

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY public/ ./public/
COPY data/ ./data/

RUN mkdir -p /app/userdata

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -sf http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
