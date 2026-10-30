# Bun only installs packages (from package-lock.json); Node runs the app.
FROM oven/bun:1.4.4-alpine@sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a AS bun

# --- Deps: node_modules keyed only by the lockfile ---
FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS deps

# Not /app: the project has an app/ folder, and with the root at /app Vite reads
# an absolute /app/lib/x as root-relative, resolving lib/ files into app/lib/.
WORKDIR /frontend

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY next.config.* ./
COPY tailwind.config.* ./
COPY postcss.config.* ./
COPY intlayer.config.* ./
# postinstall runs it after intlayer build
COPY scripts/build-locale-packs.mjs ./scripts/

# The marker lets scripts/dev-entrypoint.sh detect a lockfile or Node change and
# refresh the node_modules volume without rebuilding the image.
RUN --mount=type=cache,target=/root/.bun/install/cache \
  bun install --frozen-lockfile --network-concurrency=16 && \
  echo "$(md5sum package-lock.json) $(node -v)" > node_modules/.lockfile-hash

# --- Dev stage (used by docker-compose.dev.yml) ---
# Source is bind-mounted at runtime; Vite compiles on demand, so no build here.
FROM deps AS dev

ENV NODE_ENV=development

CMD ["sh", "scripts/dev-entrypoint.sh", "npm", "run", "dev"]

# --- Build stage ---
FROM deps AS builder

WORKDIR /build
COPY --from=deps /frontend/node_modules ./node_modules

# Copy source code
COPY . .

# Set build-time environment variables
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

# Product name (APP_NAME in the root .env); the UI and its translations bake it in
ARG NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
# rewrites() in next.config.mjs are resolved at build time
ARG API_PROXY_TARGET
ENV API_PROXY_TARGET=${API_PROXY_TARGET}

# Build application
RUN npm run build

# Production stage (standalone output)
FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS runner

WORKDIR /app

# OS security fixes newer than the base image; npm and corepack are not used at
# runtime and only carry npm's bundled packages into the image scan.
RUN apk upgrade --no-cache && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

ENV NODE_ENV=production
ENV PORT=3000
# vinext binds to HOST (HOSTNAME is the container name on Linux)
ENV HOST="0.0.0.0"

# Non-root runtime user. Files are copied in already owned by it: a `chown -R`
# after the copies would store every file a second time in its own layer.
RUN addgroup -S app && adduser -S app -G app && chown app:app /app

# vinext standalone output: server.js, the build (static files are served from
# dist/client, public/ included) and the minimal runtime node_modules. Its own
# public/ copy is never read, so it stays out of the image.
COPY --chown=app:app --from=builder /build/dist/standalone/server.js /build/dist/standalone/package.json ./
COPY --chown=app:app --from=builder /build/dist/standalone/dist ./dist
COPY --chown=app:app --from=builder /build/dist/standalone/node_modules ./node_modules

USER app

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD ["node", "-e", "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]

# Start application
CMD ["node", "server.js"]
