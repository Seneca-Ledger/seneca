# Docker инструкции для Seneca

Все команды выполняются из корня репозитория и требуют Docker Compose v2 (`docker compose`).

## Быстрый запуск в Docker

### 1. Настройка переменных окружения

Сгенерируйте `.env`, `backend/.env` и `frontend/.env.local` со случайными секретами (уже заданные значения не перезаписываются):

```bash
npm run setup:env   # или: make setup
```

Compose не стартует без этих переменных в корневом `.env`:

```bash
POSTGRES_USER=finflow
POSTGRES_PASSWORD=<openssl rand -base64 32>
JWT_SECRET=<openssl rand -base64 32>
JWT_REFRESH_SECRET=<openssl rand -base64 32>
INTEGRATIONS_ENCRYPTION_KEY=<openssl rand -base64 32>
```

Интеграции (SMTP, AI, S3/WebDAV/IMAP, Telegram) настраиваются в UI; env-переменные для них — только fallback.

### 2. Запуск всех сервисов

```bash
# Готовые образы из GHCR (IMAGE_TAG в .env фиксирует версию)
docker compose pull
docker compose up -d

# Или локальная сборка
docker compose up -d --build

# Просмотр логов
docker compose logs -f

# Остановка
docker compose down
```

### 3. Доступ к приложению

- Frontend: http://localhost:3000 (`FRONTEND_PORT`)
- Backend API: http://localhost:3001/api/v1 (`BACKEND_PORT`)
- PostgreSQL: 127.0.0.1:`POSTGRES_PORT` (5434 в сгенерированном `.env`, 5432 по умолчанию в compose)
- Redis: 127.0.0.1:`REDIS_PORT` (6379)

PostgreSQL и Redis доступны только с localhost.

## Режимы запуска

### Production режим

```bash
docker compose up -d
```

### Development режим (с hot-reload)

```bash
npm run setup:dev:docker   # env, сборка, ожидание готовности backend, demo-пользователь
# или вручную:
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

В development режиме код монтируется в контейнеры, изменения применяются без пересборки. `node_modules` и `.next` лежат в именованных volumes; при изменении `package-lock.json` контейнер сам выполнит `npm ci` при следующем старте.

### Карты чеков (опционально)

```bash
# OSM-выгрузка региона (по умолчанию Казахстан)
echo 'MAP_PBF_URL=https://download.geofabrik.de/europe/switzerland-latest.osm.pbf' >> .env
docker compose --profile maps --profile geocoder up -d
```

После этого задайте backend `TILESERVER_URL=http://tileserver:8080` и `GEOCODER_URL=http://nominatim:8080` и перезапустите его. Первый импорт занимает от минут до часов и несколько ГБ диска.

## Управление контейнерами

### Просмотр статуса

```bash
docker compose ps
```

### Просмотр логов

```bash
# Все сервисы
docker compose logs -f

# Конкретный сервис
docker compose logs -f backend
docker compose logs -f frontend
```

### Перезапуск сервиса

```bash
docker compose restart backend
docker compose restart frontend
```

### Остановка и удаление

```bash
# Остановка
docker compose stop

# Остановка и удаление контейнеров
docker compose down

# Остановка и удаление с volumes (удалит данные БД!)
docker compose down -v
```

## Работа с базой данных

Контейнеры называются `finflow-postgres`, `finflow-redis`, `finflow-backend`, `finflow-frontend`.

### Подключение к PostgreSQL

```bash
make db-shell
# или
docker exec -it finflow-postgres psql -U "$POSTGRES_USER" -d "${POSTGRES_DB:-finflow}"
```

### Выполнение миграций

Миграции выполняются автоматически при запуске backend (`RUN_MIGRATIONS`, включено по умолчанию). В dev-контейнере их можно прогнать вручную:

```bash
make migrate
```

В production-образе нет npm, поэтому `make migrate` работает только с dev-контейнером.

### Бэкап базы данных

```bash
make db-backup
```

### Восстановление базы данных

```bash
make db-restore file=backup.sql
```

## Пересборка контейнеров

```bash
# Пересборка всех сервисов
docker compose build --no-cache

# Пересборка конкретного сервиса
docker compose build --no-cache backend
docker compose build --no-cache frontend

# Пересборка и перезапуск
docker compose up -d --build
```

## Переменные окружения

Переменные окружения можно задать:

1. **Через .env файл** (рекомендуется): корневой `.env` читается compose и передаётся backend.

2. **Через docker-compose.yml**:
   ```yaml
   environment:
     - JWT_SECRET=${JWT_SECRET}
   ```

3. **Через командную строку** (остальные обязательные переменные тоже должны быть заданы):
   ```bash
   JWT_SECRET=secret docker compose up
   ```

## Troubleshooting

### Проблема: Контейнер не запускается

```bash
# Проверьте логи
docker compose logs backend

# Проверьте статус
docker compose ps

# Пересоберите контейнер
docker compose build --no-cache backend
docker compose up -d backend
```

Частая причина — не задана обязательная переменная: compose сообщает `... is required`, backend в production падает с `Missing required environment variable`.

### Проблема: База данных не подключается

```bash
# Проверьте, что PostgreSQL запущен
docker compose ps postgres

# Проверьте логи PostgreSQL
docker compose logs postgres

# Проверьте подключение
docker exec -it finflow-postgres psql -U "$POSTGRES_USER" -d "${POSTGRES_DB:-finflow}" -c "SELECT 1;"
```

### Проблема: Порты заняты

Поменяйте порт в `.env`, править `docker-compose.yml` не нужно:

```bash
BACKEND_PORT=3002
FRONTEND_PORT=3005
POSTGRES_PORT=5435
REDIS_PORT=6380
```

### Проблема: Изменения в коде не применяются

В production режиме нужно пересобрать контейнер:

```bash
docker compose up -d --build
```

В development режиме изменения применяются автоматически.

### Проблема: После логина сразу выкидывает на страницу входа

Сессия хранится в cookies. Проверьте, что `CORS_ORIGINS` (или `FRONTEND_URL`) совпадает с адресом frontend, а при frontend и API на разных доменах задан `AUTH_COOKIE_SAMESITE=none` и включён HTTPS.

### Очистка Docker

```bash
# Удалить все остановленные контейнеры
docker container prune

# Удалить неиспользуемые образы
docker image prune

# Полная очистка (осторожно!)
docker system prune -a --volumes
```

## Production развёртывание

Для production:

1. Используйте готовые образы `ghcr.io/seneca-ledger/seneca-backend` и `seneca-frontend` с фиксированным `IMAGE_TAG`
2. Настройте HTTPS через reverse proxy (nginx, Caddy, Traefik)
3. Задайте `CORS_ORIGINS` (или `FRONTEND_URL`); без него backend не стартует
4. Используйте внешнюю БД (не в Docker)
5. Для мониторинга задайте `METRICS_AUTH_TOKEN` и собирайте `/api/v1/metrics` своим коллектором (`Authorization: Bearer <token>`)
6. Используйте секреты из secure vault

Backend доверяет одному прокси и считает rate limit по IP клиента, поэтому прокси должен передавать `X-Forwarded-For` и `X-Forwarded-Proto`. Пример с nginx:

```nginx
upstream backend {
    server backend:3001;
}

upstream frontend {
    server frontend:3000;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    location /api {
        proxy_pass http://backend;
    }

    location / {
        proxy_pass http://frontend;
    }
}
```

## Health Checks

PostgreSQL и Redis проверяются healthcheck-ами в compose; production-образы backend и frontend содержат собственный `HEALTHCHECK`.

```bash
curl http://localhost:3001/api/v1/health         # liveness
curl http://localhost:3001/api/v1/health/ready   # проверка БД, 503 при ошибке
curl http://localhost:3000
```

## Volumes

Данные сохраняются в volumes:

- `postgres_data` - данные PostgreSQL
- `redis_data` - данные Redis
- `backend_uploads` - загруженные файлы
- `map_data`, `nominatim_data` - тайлы и база геокодера (профили `maps`/`geocoder`)

В dev-режиме: `postgres_dev_data`, `redis_dev_data`, `backend_node_modules`, `frontend_node_modules`, `frontend_next`.

Для просмотра volumes (имя получает префикс проекта compose, обычно имя каталога):

```bash
docker volume ls
docker volume inspect seneca_postgres_data
```
