# --- Deps: node_modules keyed only by the lockfile ---
FROM node:24-alpine AS deps

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY next.config.* ./
COPY tailwind.config.* ./
COPY postcss.config.* ./
COPY intlayer.config.* ./

# The marker lets scripts/dev-entrypoint.sh detect a lockfile or Node change and
# refresh the node_modules volume without rebuilding the image.
RUN npm ci && echo "$(md5sum package-lock.json) $(node -v)" > node_modules/.lockfile-hash

# --- Dev stage (used by docker-compose.dev.yml) ---
# Source is bind-mounted at runtime; Turbopack compiles on demand, so no build here.
FROM deps AS dev

ENV NODE_ENV=development

CMD ["sh", "scripts/dev-entrypoint.sh", "npm", "run", "dev"]

# --- Build stage ---
FROM deps AS builder

# Not /app: with the project at /app, webpack resolves `@/lib/...` imports into
# the App Router's app/lib/ (both have a theme-tokens.ts) and prerendering fails.
WORKDIR /build
COPY --from=deps /app/node_modules ./node_modules

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
# rewrites() in next.config.js are resolved at build time
ARG API_PROXY_TARGET
ENV API_PROXY_TARGET=${API_PROXY_TARGET}

# Build application
RUN npm run build

# Production stage (standalone output)
FROM node:24-alpine AS runner

WORKDIR /app

# OS security fixes newer than the base image; npm and corepack are not used at
# runtime and only carry npm's bundled packages into the image scan.
RUN apk upgrade --no-cache && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Next.js standalone output already contains the minimal runtime node_modules.
COPY --from=builder /build/.next/standalone ./
COPY --from=builder /build/.next/static ./.next/static
COPY --from=builder /build/public ./public

# Use non-root user for runtime
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD ["node", "-e", "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]

# Start application
CMD ["node", "server.js"]
