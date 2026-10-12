# --- Base: runtime OS deps shared by every stage ---
FROM node:24-bookworm-slim AS base

# Pinned explicitly (not just relying on the base image's default) so a date
# built from local Date parts (new Date(year, month, day), used throughout
# statement parsing) round-trips through toISOString()/Postgres without a
# timezone-dependent day shift.
ENV TZ=UTC

WORKDIR /app

# Python + pdfplumber for PDF parsing + pdf2image for thumbnails. Lives in the
# first stage so it is cached independently of package.json and source changes.
# Pillow comes from requirements.txt rather than the distro's python3-pil so the
# pinned version is the one that actually ships.
COPY requirements.txt ./
RUN apt-get update && \
  apt-get install -y --no-install-recommends python3 python3-pip poppler-utils && \
  pip3 install --no-cache-dir --break-system-packages -r requirements.txt && \
  rm -rf /var/lib/apt/lists/*

# --- Deps: node_modules keyed only by the lockfile ---
FROM base AS deps

COPY package*.json ./

# The marker lets scripts/dev-entrypoint.sh detect a lockfile or Node change and
# refresh the node_modules volume without rebuilding the image.
RUN npm ci && echo "$(md5sum package-lock.json) $(node -v)" > node_modules/.lockfile-hash

# --- Dev stage (used by docker-compose.dev.yml) ---
# Source is bind-mounted at runtime, so nothing is copied or compiled here.
FROM deps AS dev

ENV NODE_ENV=development

CMD ["sh", "scripts/dev-entrypoint.sh", "npm", "run", "start:dev"]

# --- Builder: compile src/ and scripts/ into dist/, then drop devDependencies ---
FROM deps AS builder

COPY . .

RUN npm run build && npm run build:scripts && npm prune --omit=dev

# --- Production stage ---
FROM base

# The runtime only runs `node`; npm and corepack (kept in the earlier stages,
# which install with them) would only carry npm's bundled packages into the image.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

RUN groupadd --system app && useradd --system --gid app app && \
  mkdir -p uploads/reports && chown -R app:app /app

# Pruned in the builder so the runtime image carries only production deps.
COPY --chown=app:app --from=builder /app/package*.json ./
COPY --chown=app:app --from=builder /app/node_modules ./node_modules
COPY --chown=app:app --from=builder /app/dist ./dist
COPY --chown=app:app --from=builder /app/scripts ./scripts

USER app

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD ["node", "-e", "require('http').get('http://localhost:3001/api/v1/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]

# Start application
CMD ["node", "dist/main.js"]
