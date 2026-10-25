# Seneca Frontend

Frontend приложение для системы обработки банковских выписок на базе Next.js.

## Установка

```bash
npm install
```

`postinstall` и `prebuild` запускают `intlayer build` — без конфигурации intlayer не работают ни установка, ни сборка.

## Настройка окружения

`.env.local` генерируется из корня репозитория и не коммитится:

```bash
npm run setup:env
```

Основные переменные: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPPORT_EMAIL`. Запросы `/api/*` и `/uploads/*` проксируются на `API_PROXY_TARGET` (по умолчанию `http://127.0.0.1:3001`). В production-образе значения `NEXT_PUBLIC_*` фиксируются на этапе сборки.

## Запуск приложения

### Development

```bash
npm run dev
```

Приложение будет доступно по адресу: `http://localhost:3000`

### Production

```bash
npm run build   # next build --webpack
npm run start
```

## Тесты и проверки

```bash
npm test             # Vitest
npm run lint:check   # Biome
npm run lint:fix     # автоисправление Biome
npm run lint:css     # stylelint для SCSS
npm run type-check   # TypeScript
```

## Структура проекта

```
app/
├── (auth)/          # Вход, регистрация, сброс пароля, подтверждение email
├── (main)/          # Основные разделы приложения
├── (onboarding)/    # Онбординг
├── components/      # React компоненты
├── contexts/        # React-контексты (auth, workspace)
├── hooks/           # Custom hooks
├── lib/             # API клиент (axios), CSRF-хелпер, утилиты
├── styles/          # Глобальные SCSS
├── tours/           # Интерактивные туры (driver.js)
├── layout.tsx       # Root layout
└── page.tsx         # Главная страница
components/          # Общие компоненты вне app/
lib/                 # Общие утилиты вне app/
proxy.ts             # Next.js proxy
```

## Авторизация

Токены хранятся в HttpOnly-cookies и недоступны JavaScript: axios-клиент отправляет запросы с `withCredentials`, а для изменяющих запросов добавляет заголовок `x-csrf-token` из cookie `csrf_token` (`app/lib/csrf.ts`).
