---
title: Coding Standards
description: TypeScript conventions and formatting
---

Seneca uses Biome for linting and formatting in both apps; frontend SCSS is checked with stylelint. Follow the conventions of the surrounding code.

## Language and formatting

- TypeScript everywhere
- Biome formatting: 2 spaces, single quotes, semicolons, 100-character lines
- Prefer `const` (`useConst` is an error)
- Avoid `any` (`noExplicitAny` warns)
- Keep functions small and focused

## Naming conventions

- `camelCase` for variables and functions
- `PascalCase` for classes, types, and React component files (for example `AppChrome.tsx`)
- `kebab-case` for other files (for example `password-reset.service.ts`)
- `UPPER_SNAKE_CASE` for constants

Biome does not enforce naming (`useNamingConvention` is off), so match the files next to yours.

## Lint and format

```bash
npm --prefix backend run lint:check
npm --prefix frontend run lint:check
npm --prefix backend run lint:fix
npm --prefix frontend run lint:fix
make format
```

## Backend rules

- Every tenant-owned query filters by `workspaceId`
- Keep controllers thin: logic in services, input validation in DTOs
- Schema changes only through migrations

## Code review expectations

- Ensure tests cover new behavior
- Document any breaking changes
- Add migration notes for schema updates

Next: [Adding a Bank Parser](adding-a-bank-parser)
