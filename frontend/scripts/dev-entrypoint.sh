#!/bin/sh
# Dev container entrypoint: node_modules lives in a named Docker volume so it
# survives restarts. Refresh it only when package-lock.json changed, then exec
# the real command (e.g. `npm run start:dev`).
set -e

cd "$(dirname "$0")/.."

# Native modules (bcrypt, sharp, onnxruntime) are built for one Node ABI, so a
# Node upgrade in the image must refresh the volume just like a lockfile change.
want="$(md5sum package-lock.json) $(node -v)"
have=$(cat node_modules/.lockfile-hash 2>/dev/null || true)

if [ "$want" != "$have" ]; then
  echo "[dev-entrypoint] package-lock.json or Node changed, refreshing node_modules..."
  npm ci --no-audit --no-fund
  echo "$want" > node_modules/.lockfile-hash
fi

exec "$@"
