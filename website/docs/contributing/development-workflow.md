---
title: Development Workflow
description: Branches, PRs, and CI expectations
---

Seneca uses Conventional Commits, CI checks, and a detailed PR template to keep changes stable.

## Branching

- `main` is the production branch
- Feature work should use short-lived branches (e.g., `feat/parsing-bereke-pdf`)

## Commit messages

Conventional Commits are enforced by commitlint (`@commitlint/config-conventional`, subject case not checked) in
the husky `commit-msg` hook:

```
feat(parsing): add Bereke bank PDF parser
fix(import): handle duplicate session retries
```

The `pre-push` hook runs the backend unit tests when `backend/src` changed.

## Pull requests

The PR template asks for a description and type of change, the changes made, screenshots for UI work, testing
notes, a checklist, and notes on security impact, database, API, documentation, dependency, breaking, and
deployment changes.

## CI checks

CI runs policy-as-code, shell/Dockerfile/config scans, Biome, type checks, backend unit and e2e tests,
builds, dependency audits and license checks, a secrets scan, and a Docker image build. Frontend Vitest tests are
not part of CI — run them locally. See [CI/CD](../deployment/ci-cd).

On pull requests, changes to migrations, entities, or `data-source.ts` need the `db-approved` label; changes to the
auth module, `common/guards`, `common/decorators`, or permissions/roles code need `security-approved`.

## Local workflow

```bash
make lint-check
npm --prefix backend run typecheck
npm --prefix frontend run type-check
make test
make build
```

Next: [Testing](testing)
