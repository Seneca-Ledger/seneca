---
title: CI/CD Pipeline
description: Continuous integration and release publishing
---

Seneca's pipelines live in `.github/workflows`.

## CI pipeline

`ci.yml` runs on pull requests and on pushes to `main` and `develop`:

- `sensitive-changes` - label gate on pull requests (see below)
- `policy-as-code` - Conftest policies for the Compose files and workflows
- `shellcheck`, `hadolint`, `trivy-config` - shell script, Dockerfile, and config scanning
- `lint` - Biome for both apps
- `typecheck` - TypeScript checks for both apps
- `tests` - backend unit + e2e tests against PostgreSQL 16 and Redis 7, with migrations applied twice to check
  idempotency
- `sonarcloud` - static analysis with the backend coverage report
- `build` - frontend and backend production builds
- `dependency-scan` - npm audits and license checks for every package
- `secrets-scan` - Gitleaks
- `docker` - image build with a Trivy scan and SBOM

Frontend Vitest tests are not part of CI.

## Sensitive change protection

On pull requests, the `sensitive-changes` job requires labels:

- `db-approved` for migrations, entities, or `backend/src/data-source.ts`
- `security-approved` for the auth module, `common/guards`, `common/decorators`, or permissions/roles code

## CD pipeline

Seneca is self-hosted: `cd.yml` builds, scans, signs, and publishes images, then stops. There are no deployment
environments and no smoke tests. It runs on `v*.*.*` tags or manual dispatch:

1. Conftest policies
2. Waits for CI to succeed on the commit
3. Builds multi-arch (amd64, arm64) backend, frontend, and combined images and pushes them to GHCR, tagged
   `sha-<commit>` plus the version and `latest` on release tags
4. SLSA provenance attestation and a Trivy scan of the pushed image
5. SPDX SBOM with attestation, and a cosign attestation
6. On tags, a GitHub release with the SBOM attached

## Other workflows

- `codeql.yml` - CodeQL on pushes and pull requests to `main`/`develop`, plus weekly
- `dependency-review.yml` - dependency review on pull requests
- `scorecard.yml` - OpenSSF Scorecard, weekly
- `makefile.yml` - checks that `make build` works
- `docs.yml` - builds this site and deploys it to GitHub Pages when `website/` changes on `main`
- `release-please.yml` - semantic versioning and releases
- `changelog.yml` - regenerates the in-app changelog data (`frontend/public/changelog.json`) on `main`

Next: [Makefile Reference](../reference/makefile)
