# Bun only installs packages (from package-lock.json); Node runs the app.
FROM oven/bun:1.4.4-alpine@sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a AS bun

# Build stage
FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS builder

WORKDIR /app
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

# Copy dependency manifests first for better caching
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
# postinstall runs it after intlayer build
COPY frontend/scripts/build-locale-packs.mjs ./frontend/scripts/

# Install dependencies for both apps
WORKDIR /app/backend
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --network-concurrency=16
WORKDIR /app/frontend
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --network-concurrency=16
WORKDIR /app

# Copy source code
COPY backend ./backend
COPY frontend ./frontend

# Build frontend with API proxy baked in
ARG API_PORT=4000
ENV API_PORT=${API_PORT}
ARG API_PROXY_TARGET=http://127.0.0.1:${API_PORT}
ENV API_PROXY_TARGET=${API_PROXY_TARGET}
ENV NEXT_PUBLIC_API_URL=/api/v1
# Product name; the frontend bakes it in, the backend reads APP_NAME at runtime
ARG APP_NAME=Seneca
ENV NEXT_PUBLIC_APP_NAME=${APP_NAME}
RUN npm run build --prefix frontend

# Build backend
RUN npm run build --prefix backend

# Reinstall backend with production deps only for the runtime image
WORKDIR /app/backend
RUN --mount=type=cache,target=/root/.bun/install/cache \
  rm -rf node_modules && bun install --frozen-lockfile --network-concurrency=16 --production
WORKDIR /app

# Runtime image
FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV API_PORT=4000
ENV HOST=0.0.0.0
ENV PIP_BREAK_SYSTEM_PACKAGES=1

# Install Python + pdfplumber for PDF parsing + pdf2image for thumbnails.
# Pillow comes from requirements.txt rather than Alpine's py3-pillow so the
# pinned version is the one that actually ships.
# `apk upgrade` takes OS security fixes newer than the base image (e.g. OpenSSL).
COPY backend/requirements.txt ./backend/requirements.txt
RUN apk upgrade --no-cache && \
    apk add --no-cache python3 py3-pip poppler-utils && \
    pip3 install --no-cache-dir --break-system-packages -r ./backend/requirements.txt

# The runtime only runs `node`. npm and corepack, with npm's bundled tar,
# sigstore and pacote, would only add image-scan findings.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

# Non-root runtime user. Files are copied in already owned by it: a `chown -R`
# after the copies would store every file a second time in its own layer.
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app

# Backend runtime dependencies (already pruned)
COPY --chown=app:app --from=builder /app/backend/package*.json ./backend/
COPY --chown=app:app --from=builder /app/backend/node_modules ./backend/node_modules

# Backend runtime files
COPY --chown=app:app --from=builder /app/backend/dist ./backend/dist
COPY --chown=app:app --from=builder /app/backend/scripts ./backend/scripts

# Frontend standalone output (vinext); static files, public/ included, live in dist/client
COPY --chown=app:app --from=builder /app/frontend/dist/standalone/server.js /app/frontend/dist/standalone/package.json ./frontend/
COPY --chown=app:app --from=builder /app/frontend/dist/standalone/dist ./frontend/dist
COPY --chown=app:app --from=builder /app/frontend/dist/standalone/node_modules ./frontend/node_modules

# Startup script to run both servers
COPY --chown=app:app --chmod=755 scripts/start.sh ./scripts/start.sh

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD ["node", "-e", "const http=require('http'); const port=process.env.API_PORT||4000; http.get('http://127.0.0.1:'+port+'/api/v1/health/ready', (r)=>process.exit(r.statusCode===200?0:1)).on('error', ()=>process.exit(1));"]

CMD ["./scripts/start.sh"]
