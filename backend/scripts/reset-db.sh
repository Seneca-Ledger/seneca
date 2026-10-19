#!/bin/bash
# Script to reset database and run migrations fresh
# Usage: docker compose exec backend bash scripts/reset-db.sh

set -e

echo "🗑️  Dropping existing schema..."
npx typeorm-ts-node-commonjs -d src/data-source.ts schema:drop --synchronize

echo "✅ Schema dropped"
echo ""
echo "🚀 Running migrations..."
npx typeorm-ts-node-commonjs -d src/data-source.ts migration:run

echo "✅ Migrations complete!"
echo ""
echo "Database is ready. You can now:"
echo "  - Create admin: npm run create-admin"
echo "  - Start app: npm start"
