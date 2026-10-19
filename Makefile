.PHONY: help setup start stop restart logs clean clean-build-cache test build migrate admin seed-demo quick-dev quick-start upgrade db-backup

# Variables
DOCKER_COMPOSE = docker compose
DOCKER_COMPOSE_DEV = docker compose -f docker-compose.yml -f docker-compose.dev.yml
DOCKER_EXEC_BACKEND = docker exec finflow-backend
DOCKER_EXEC_FRONTEND = docker exec -it finflow-frontend
DOCKER_EXEC_DB = docker exec -it finflow-postgres

define wait_for_backend
	@echo "⏳ Waiting for backend to become ready..."
	@port=$$(grep -E '^BACKEND_PORT=' .env 2>/dev/null | cut -d= -f2); port=$${port:-3001}; \
	for i in $$(seq 1 120); do \
		if curl -sf "http://localhost:$$port/api/v1/health/ready" >/dev/null 2>&1; then \
			break; \
		fi; \
		sleep 1; \
	done
endef

define wait_for_users_table
	@echo "⏳ Waiting for database schema..."
	@for i in $$(seq 1 60); do \
		if docker exec finflow-postgres psql -U finflow -d finflow -tAc "select 1 from information_schema.tables where table_schema='public' and table_name='users'" 2>/dev/null | grep -q 1; then \
			break; \
		fi; \
		sleep 2; \
	done
endef

##@ General

help: ## Display this help message
	@awk 'BEGIN {FS = ":.*##"; printf "\n\033[1m\033[36mUsage:\033[0m\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Setup

setup: ## Initial setup - copy env files and generate secrets
	@echo "🚀 Setting up Seneca..."
	@npm run setup:env
	@echo "✅ Setup complete!"

install: ## Install dependencies (local development)
	@echo "📦 Installing dependencies..."
	@cd backend && npm install
	@cd frontend && npm install
	@echo "✅ Dependencies installed!"

##@ Docker Operations

start: ## Start all services in production mode
	@echo "🐳 Starting Seneca (production mode)..."
	@touch .env
	@$(DOCKER_COMPOSE) up -d --build
	$(call wait_for_backend)
	@echo "✅ Seneca is running!"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend:  http://localhost:3001/api/v1"
	@echo "Swagger:  http://localhost:3001/api/docs"

upgrade: ## Pull release images from GHCR and restart (pin a version: make upgrade VERSION=v1.2.0)
	@touch .env
	@$(MAKE) --no-print-directory db-backup
	@tag=$${VERSION:-$$(grep -E '^IMAGE_TAG=' .env 2>/dev/null | cut -d= -f2)}; tag=$${tag:-latest}; \
	echo "⬇️  Pulling Seneca $$tag..."; \
	IMAGE_TAG=$$tag $(DOCKER_COMPOSE) pull backend frontend && \
	IMAGE_TAG=$$tag $(DOCKER_COMPOSE) up -d --no-build --remove-orphans
	@echo "⏳ Waiting for backend (migrations run on start)..."
	@port=$$(grep -E '^BACKEND_PORT=' .env 2>/dev/null | cut -d= -f2); port=$${port:-3001}; \
	for i in $$(seq 1 300); do \
		curl -sf "http://localhost:$$port/api/v1/health/ready" >/dev/null 2>&1 && { echo "✅ Seneca upgraded"; exit 0; }; \
		sleep 1; \
	done; \
	echo "❌ Backend not ready after 5 min: docker logs finflow-backend"; exit 1
	@docker image prune -f >/dev/null

dev: ## Start all services in development mode (with hot reload)
	@echo "🐳 Starting Seneca (development mode)..."
	@touch .env
	@$(DOCKER_COMPOSE_DEV) up -d --build
	$(call wait_for_backend)
	@echo "✅ Seneca is running in development mode!"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend:  http://localhost:3001/api/v1"
	@echo "Swagger:  http://localhost:3001/api/docs"
	@echo "Run 'make seed-demo' to create demo@seneca.dev / demo123"

stop: ## Stop all services
	@echo "🛑 Stopping Seneca..."
	@$(DOCKER_COMPOSE) down
	@echo "✅ Services stopped!"

restart: ## Restart all services
	@echo "🔄 Restarting Seneca..."
	@$(DOCKER_COMPOSE) restart
	@echo "✅ Services restarted!"

clean-build-cache: ## Remove unused Docker build cache (safe; next build re-creates what it needs)
	@docker builder prune -f
	@echo "✅ Build cache pruned!"

clean: ## Stop services and remove volumes (also resets the dev node_modules volumes)
	@echo "🧹 Cleaning up Seneca..."
	@$(DOCKER_COMPOSE_DEV) down -v --remove-orphans
	@$(DOCKER_COMPOSE) down -v --remove-orphans
	@echo "✅ Cleanup complete!"

##@ Logs

logs: ## View logs from all services
	@$(DOCKER_COMPOSE) logs -f

logs-backend: ## View backend logs
	@$(DOCKER_COMPOSE) logs -f backend

logs-frontend: ## View frontend logs
	@$(DOCKER_COMPOSE) logs -f frontend

logs-db: ## View database logs
	@$(DOCKER_COMPOSE) logs -f postgres

logs-redis: ## View Redis logs
	@$(DOCKER_COMPOSE) logs -f redis

##@ Development (Local)

backend-dev: ## Start backend in development mode (local)
	@echo "🚀 Starting backend in dev mode..."
	@cd backend && npm run start:dev

frontend-dev: ## Start frontend in development mode (local)
	@echo "🚀 Starting frontend in dev mode..."
	@cd frontend && npm run dev

db-start: ## Start only PostgreSQL and Redis
	@echo "🐘 Starting database services..."
	@$(DOCKER_COMPOSE) up -d postgres redis
	@echo "✅ Database services started!"

##@ Database

migrate: ## Run database migrations
	@echo "🔄 Running migrations..."
	@$(DOCKER_EXEC_BACKEND) npm run migration:run
	@echo "✅ Migrations complete!"

migrate-revert: ## Revert last migration
	@echo "⏪ Reverting last migration..."
	@$(DOCKER_EXEC_BACKEND) npm run migration:revert
	@echo "✅ Migration reverted!"

migrate-generate: ## Generate a new migration (usage: make migrate-generate name=MigrationName)
	@if [ -z "$(name)" ]; then \
		echo "❌ Error: Migration name required. Usage: make migrate-generate name=MigrationName"; \
		exit 1; \
	fi
	@echo "📝 Generating migration: $(name)..."
	@$(DOCKER_EXEC_BACKEND) npm run migration:generate -- $(name)
	@echo "✅ Migration generated!"

db-shell: ## Open PostgreSQL shell
	@echo "🐘 Opening database shell..."
	@$(DOCKER_EXEC_DB) psql -U finflow -d finflow

db-backup: ## Backup database
	@echo "💾 Creating database backup..."
	@file=backup_$$(date +%Y%m%d_%H%M%S).sql; \
	docker exec finflow-postgres sh -c 'pg_dump -U "$$POSTGRES_USER" "$$POSTGRES_DB"' > $$file || { rm -f $$file; exit 1; }; \
	echo "✅ Backup created: $$file"

db-restore: ## Restore database (usage: make db-restore file=backup.sql)
	@if [ -z "$(file)" ]; then \
		echo "❌ Error: Backup file required. Usage: make db-restore file=backup.sql"; \
		exit 1; \
	fi
	@echo "📥 Restoring database from $(file)..."
	@cat $(file) | docker exec -i finflow-postgres sh -c 'psql -U "$$POSTGRES_USER" "$$POSTGRES_DB"'
	@echo "✅ Database restored!"

##@ User Management

admin: ## Create admin user (usage: make admin email=admin@example.com password=admin123 name="Admin")
	@if [ -z "$(email)" ] || [ -z "$(password)" ] || [ -z "$(name)" ]; then \
		echo "❌ Error: All parameters required."; \
		echo "Usage: make admin email=admin@example.com password=admin123 name=\"Admin User\""; \
		exit 1; \
	fi
	@echo "👤 Creating admin user..."
	$(call wait_for_users_table)
	@if docker inspect -f '{{.State.Running}}' finflow-backend >/dev/null 2>&1; then \
		if [ "$$(docker exec finflow-backend printenv NODE_ENV 2>/dev/null)" = "development" ]; then \
			docker exec finflow-backend sh -lc 'NODE_OPTIONS=--max-old-space-size=2048 npm run create-admin:dev -- $(email) $(password) "$(name)"'; \
		elif docker exec finflow-backend sh -lc 'test -f dist/scripts/create-admin.js'; then \
			docker exec finflow-backend node dist/scripts/create-admin.js $(email) $(password) "$(name)"; \
		else \
			echo "❌ No create-admin entrypoint available in finflow-backend"; \
			exit 1; \
		fi; \
	else \
		cd backend && npm run create-admin -- $(email) $(password) "$(name)"; \
	fi
	@echo "✅ Admin user created!"

seed-demo: ## Create demo user (demo@seneca.dev / demo123)
	@echo "👤 Creating demo user..."
	$(call wait_for_users_table)
	@if docker inspect -f '{{.State.Running}}' finflow-backend >/dev/null 2>&1; then \
		if [ "$$(docker exec finflow-backend printenv NODE_ENV 2>/dev/null)" = "development" ]; then \
			docker exec finflow-backend sh -lc 'NODE_OPTIONS=--max-old-space-size=2048 npm run seed:demo:dev'; \
		elif docker exec finflow-backend sh -lc 'test -f dist/scripts/seed-demo.js'; then \
			docker exec finflow-backend node dist/scripts/seed-demo.js; \
		else \
			echo "❌ No seed-demo entrypoint available in finflow-backend"; \
			exit 1; \
		fi; \
	else \
		cd backend && npm run build:scripts && npm run seed:demo; \
	fi
	@echo "✅ Demo user is ready!"

##@ Testing

test: ## Run all tests
	@echo "🧪 Running tests..."
	@cd backend && npm test
	@cd frontend && npm test
	@echo "✅ Tests complete!"

test-backend: ## Run backend tests
	@echo "🧪 Running backend tests..."
	@cd backend && npm test

test-frontend: ## Run frontend tests
	@echo "🧪 Running frontend tests..."
	@cd frontend && npm test

test-watch: ## Run backend tests in watch mode
	@echo "🧪 Running tests in watch mode..."
	@cd backend && npm run test:watch

test-cov: ## Run tests with coverage
	@echo "🧪 Running tests with coverage..."
	@cd backend && npm run test:cov
	@echo "📊 Coverage report: backend/coverage/lcov-report/index.html"

test-e2e: ## Run end-to-end tests
	@echo "🧪 Running E2E tests..."
	@cd backend && npm run test:e2e

##@ Code Quality

lint: ## Lint and fix code
	@echo "🔍 Linting code (Biome)..."
	@cd backend && npm run lint
	@cd frontend && npm run lint
	@echo "✅ Linting complete!"

lint-check: ## Check linting without fixing
	@echo "🔍 Checking linting (Biome)..."
	@cd backend && npm run lint:check
	@cd frontend && npm run lint:check
	@echo "✅ Linting check complete!"

format: ## Format code with Biome
	@echo "✨ Formatting code..."
	@cd backend && npm run format
	@cd frontend && npm run format
	@echo "✅ Formatting complete!"

type-check: ## Run TypeScript type checking
	@echo "🔍 Type checking..."
	@cd backend && npm run build
	@cd frontend && npm run type-check || echo "No type-check script"
	@echo "✅ Type checking complete!"

##@ Build

build: ## Build for production
	@echo "🏗️  Building Seneca..."
	@cd backend && npm run build
	@cd frontend && npm run build
	@echo "✅ Build complete!"

build-docker: ## Build Docker images
	@echo "🐳 Building Docker images..."
	@$(DOCKER_COMPOSE) build
	@echo "✅ Docker images built!"

##@ Utilities

shell-backend: ## Open shell in backend container
	@$(DOCKER_EXEC_BACKEND) bash

shell-frontend: ## Open shell in frontend container
	@$(DOCKER_EXEC_FRONTEND) sh

shell-db: ## Open shell in database container
	@$(DOCKER_EXEC_DB) bash

health: ## Check health of all services
	@echo "🏥 Checking service health..."
	@echo "\n📡 Backend:"
	@curl -s http://localhost:3001/api/v1/health || echo "❌ Backend not responding"
	@echo "\n🌐 Frontend:"
	@curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "❌ Frontend not responding"
	@echo "\n🐘 PostgreSQL:"
	@$(DOCKER_EXEC_DB) pg_isready -U finflow || echo "❌ PostgreSQL not ready"
	@echo "\n🔴 Redis:"
	@docker exec finflow-redis redis-cli ping || echo "❌ Redis not responding"
	@echo ""

ps: ## Show running containers
	@$(DOCKER_COMPOSE) ps

stats: ## Show container resource usage
	@docker stats --no-stream finflow-backend finflow-frontend finflow-postgres finflow-redis

##@ Documentation

docs: ## Open API documentation
	@echo "📚 Opening Swagger documentation..."
	@open http://localhost:3001/api/docs || xdg-open http://localhost:3001/api/docs || echo "Open http://localhost:3001/api/docs"

##@ Quick Actions

quick-dev: ## Zero-config startup: dev containers + demo user
	@npm run setup:dev:docker

quick-start: ## Legacy alias for quick-dev
	@$(MAKE) quick-dev
	@echo ""
	@echo "📖 Next steps:"
	@echo "   - View logs:        make logs"
	@echo "   - Stop services:    make stop"
	@echo "   - Run tests:        make test"
	@echo "   - View all commands: make help"
	@echo ""

update: ## Update dependencies
	@echo "📦 Updating dependencies..."
	@cd backend && npm update
	@cd frontend && npm update
	@echo "✅ Dependencies updated!"

reset: clean setup start ## Complete reset - clean, setup, and start
	@echo "✅ Seneca has been reset!"
