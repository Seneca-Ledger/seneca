#!/bin/sh
set -e

API_PORT="${API_PORT:-4000}"
FRONTEND_PORT="${PORT:-3000}"
DEFAULT_UPLOADS_DIR="/app/data/uploads"
UPLOADS_DIR="${UPLOADS_DIR:-${DEFAULT_UPLOADS_DIR}}"

# Ensure uploads directory exists and is writable; fall back to an internal path if needed
if ! mkdir -p "${UPLOADS_DIR}" 2>/dev/null; then
  echo "WARN: Cannot create uploads dir at ${UPLOADS_DIR}, falling back to ${DEFAULT_UPLOADS_DIR}"
  UPLOADS_DIR="${DEFAULT_UPLOADS_DIR}"
  if ! mkdir -p "${UPLOADS_DIR}"; then
    echo "ERROR: Failed to create uploads dir at ${UPLOADS_DIR}"
    exit 1
  fi
fi
export UPLOADS_DIR

# Extra subfolders used by reports and other features
mkdir -p "${UPLOADS_DIR}/reports" "${UPLOADS_DIR}/telegram" "${UPLOADS_DIR}/custom-field-icons"

echo "Running DB migrations..."
node backend/scripts/run-migrations-with-lock.js
echo "DB migrations done"

echo "Starting backend on port ${API_PORT}"
PORT="${API_PORT}" node backend/dist/main.js &
BACKEND_PID=$!

cleanup() {
  echo "Shutting down processes..."
  kill "${BACKEND_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting frontend on port ${FRONTEND_PORT}"
cd frontend
HOST=0.0.0.0 PORT="${FRONTEND_PORT}" exec node server.js
