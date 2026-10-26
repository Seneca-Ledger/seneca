#!/bin/bash

set -e

echo "Seneca quick start"
echo ""

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker is not installed."
  echo "Install Docker from https://www.docker.com/get-started"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Error: Docker is not running."
  exit 1
fi

if ! command -v docker-compose >/dev/null 2>&1; then
  echo "Error: docker-compose is not installed."
  exit 1
fi

if ! command -v make >/dev/null 2>&1; then
  echo "Error: make is not installed."
  exit 1
fi

echo "Starting Seneca in development mode..."
make quick-dev

echo ""
echo "Done."
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:3001/api/v1"
echo "Swagger:  http://localhost:3001/api/docs"
echo "Login:    demo@seneca.dev / demo123"
