# Lumio Backend

Backend приложение для системы обработки банковских выписок на базе NestJS.

## Установка

```bash
npm install
```

## Настройка окружения

Проще всего сгенерировать env-файлы из корня репозитория — команда допишет недостающие значения и сгенерирует секреты, не трогая уже заданные:

```bash
npm run setup:env
```

`.env.example` — минимальный пример, `.env.all-options` — полный справочник переменных.

Пользовательские интеграции настраиваются через UI на уровне workspace:

- **Integrations → SMTP email** для приглашений, ссылок сброса пароля и подтверждения смены email. Хост из UI должен быть публичным; SMTP-relay во внутренней сети — через `SMTP_HOST`/`SMTP_FROM`.
- **Settings → Telegram** для bot token.
- **Integrations → S3-compatible/WebDAV/IMAP** для storage и receipt import. Адреса из UI должны резолвиться в публичные IP — egress guard отклоняет приватные и loopback-хосты при сохранении и при каждом подключении.
- **Integrations → Application URL** для публичного URL ссылок.

Env оставлен для инфраструктуры и bootstrap/fallback: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `INTEGRATIONS_ENCRYPTION_KEY`, `FRONTEND_URL`/`APP_URL`. Если SMTP не задан ни в UI, ни через fallback env, ссылка приглашения всё равно вернётся в ответе API, но письмо отправлено не будет; сброс пароля и смена email без SMTP не завершатся — их ссылки приходят только письмом.

Сессии и безопасность:

- `CORS_ORIGINS` — список origin через запятую для запросов с cookies (по умолчанию `FRONTEND_URL`). В production без него backend не стартует.
- `AUTH_COOKIE_SAMESITE` (`lax` по умолчанию; `none` — если frontend и API на разных доменах, только HTTPS), `AUTH_COOKIE_DOMAIN`.
- `JWT_EXPIRES_IN` (30m) и `JWT_REFRESH_EXPIRES_IN` (30d).
- `PASSWORD_RESET_TOKEN_SECRET` (по умолчанию `JWT_SECRET`), `BCRYPT_ROUNDS` (10–15, по умолчанию 12).
- `METRICS_AUTH_TOKEN` — без него `/api/v1/metrics` в production отвечает 403.

Карты чеков (опционально, только self-hosted): `GEOCODER_URL`, `TILESERVER_URL`, `MAP_DEFAULT_STYLE`. Сервисы поднимаются профилями `docker compose --profile maps --profile geocoder up -d`, подробности — в корневом README.

## Резервные копии workspace

Backups в **Settings → Sync** создают переносимый файл `.lumio-backup`: открытый манифест не содержит пользовательских данных, а JSON-данные и оригиналы документов зашифрованы AES-256-GCM. Пароль восстановления обязателен и не хранится в открытом виде. Без него копию восстановить невозможно.

Для ежедневных запусков задайте `BACKUP_MASTER_KEY` (отдельный стабильный секрет длиной не менее 32 байт) и, если используется серверная папка, `BACKUP_LOCAL_ROOT` — выделенную writable-директорию. В конфигурации разрешены только относительные имена папок внутри этого root, поэтому backup не может записать файл в произвольный путь на сервере. Для Nextcloud сначала подключите WebDAV-интеграцию с app password, затем выберите Nextcloud в настройках backups. Lumio публикует завершённый файл атомарно и хранит последние семь версий по умолчанию.

Импорт всегда создаёт новый workspace для текущего пользователя; merge и замена существующего workspace не выполняются. Пароли, сессии, OAuth/API-токены, участники, webhooks и история уведомлений не экспортируются.

## Запуск базы данных

PostgreSQL и Redis запускаются из корня репозитория (нужен корневой `.env`, см. выше):

```bash
make db-start   # docker compose up -d postgres redis
```

## Миграции

Схема базы управляется миграциями (TypeORM synchronize отключён).

- По умолчанию миграции запускаются автоматически при старте приложения.
- Чтобы отключить автозапуск (например, в `production`), установите `RUN_MIGRATIONS=false` и применяйте миграции вручную.

```bash
# dev: ts-node, без блокировки
npm run migration:run:dev

# prod-путь: собирает скрипты и берёт блокировку от параллельных запусков
npm run migration:run

# в dev-контейнере backend
docker exec -it finflow-backend npm run migration:run:dev
```

## Запуск приложения

### Development

```bash
npm run start:dev
```

### Production

```bash
npm run build
npm run start:prod
```

## Тесты и проверки

```bash
npm test                # unit-тесты (Jest)
npm run test:e2e        # e2e, нужны PostgreSQL и Redis
npm run test:golden     # golden-тесты парсинга
npm run lint:check      # Biome
npm run typecheck       # TypeScript
```

## Структура проекта

```
src/
├── common/          # Общие утилиты, фильтры, guards (в т.ч. CSRF), interceptors
├── config/          # Конфигурации (БД, и т.д.)
├── config-assets/   # Профили банков для парсинга
├── emails/          # Шаблоны писем (React Email)
├── entities/        # TypeORM сущности
├── modules/         # Модули приложения
├── migrations/      # Миграции БД
├── app.module.ts    # Корневой модуль
├── data-source.ts   # DataSource для TypeORM CLI
└── main.ts          # Точка входа
@tests/              # unit, integration, e2e, fixtures, helpers
```

## API

API доступно по адресу: `http://localhost:3001/api/v1`

- Swagger: `http://localhost:3001/api/docs` (не публикуется при `NODE_ENV=production`)
- Health: `GET /api/v1/health` (liveness), `GET /api/v1/health/ready` (проверка БД)

Браузерный клиент авторизуется HttpOnly-cookies `access_token`/`refresh_token`; изменяющие запросы с такими cookies должны передавать заголовок `x-csrf-token` со значением cookie `csrf_token`. Скрипты и интеграции могут использовать `Authorization: Bearer <token>` или `X-Api-Key` — такие запросы CSRF-проверку не проходят.
