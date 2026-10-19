#!/bin/bash

# Script to start Seneca in Docker

set -e

echo "🐳 Seneca - Docker Startup Script"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
  echo "⚠️  .env file not found. Creating from .env.example..."
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "✅ Created .env file"
    echo "⚠️  IMPORTANT: Edit .env and set JWT_SECRET and JWT_REFRESH_SECRET!"
  else
    echo "❌ .env.example not found. Please create .env manually."
    exit 1
  fi
fi

# Check if JWT secrets are set
if grep -q "change-this-secret-in-production" .env || grep -q "your-super-secret" .env; then
  echo "⚠️  WARNING: JWT secrets are not set in .env!"
  echo "   Please generate secure secrets:"
  echo "   openssl rand -base64 32"
  echo ""
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Start services
echo "🚀 Starting Docker containers..."
docker-compose up -d --build

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check health
echo ""
echo "🔍 Checking service health..."

# Check PostgreSQL
if docker exec seneca-postgres pg_isready -U seneca > /dev/null 2>&1; then
  echo "✅ PostgreSQL is ready"
else
  echo "❌ PostgreSQL is not ready"
fi

# Check Redis
if docker exec seneca-redis redis-cli ping > /dev/null 2>&1; then
  echo "✅ Redis is ready"
else
  echo "❌ Redis is not ready"
fi

# Check Backend
sleep 3
if curl -s http://localhost:3001/api/v1/health > /dev/null; then
  echo "✅ Backend is ready"
else
  echo "⏳ Backend is starting (may take a moment)..."
fi

# Check Frontend
sleep 2
if curl -s http://localhost:3000 > /dev/null; then
  echo "✅ Frontend is ready"
else
  echo "⏳ Frontend is starting (may take a moment)..."
fi

echo ""
echo "✨ Services are starting!"
echo ""
echo "📱 Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001/api/v1"
echo ""
echo "📊 View logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 Stop services:"
echo "   docker-compose down"
echo ""








