# OpenSSF Best Practices badge — answers (passing level)

Answers for https://www.bestpractices.dev (project entry is "In progress"). Each row is
one form field: pick the status, paste the justification. `REPO` =
https://github.com/stoic-budget/stoic-budget. Facts checked against `origin/main` on 2026-10-29.

## Basics

| Criterion | Status | Justification |
| --- | --- | --- |
| description_good | Met | REPO/blob/main/README.md: self-hosted personal and small-team finance app — bank statement import, budgets, reports, invoicing. |
| interact | Met | Website https://stoic-budget.github.io/stoic-budget/ and README explain how to get it (Docker images on ghcr.io), report issues (GitHub Issues) and contribute (CONTRIBUTING). |
| contribution | Met | REPO/blob/main/.github/CONTRIBUTING.md (fork, branch, PR, review, CI). |
| contribution_requirements | Met | CONTRIBUTING: Conventional Commits (commitlint hook), Biome lint/format, typecheck, tests required with new code; PR template REPO/blob/main/.github/PULL_REQUEST_TEMPLATE.md. |
| floss_license | Met | MIT. |
| floss_license_osi | Met | MIT is OSI-approved. |
| license_location | Met | REPO/blob/main/LICENSE |
| documentation_basics | Met | README (quick start, self-hosting), website docs (website/docs), backend/docs/DOCKER.md. |
| documentation_interface | Met | REST API described with OpenAPI (NestJS Swagger, served outside production at `/api/docs`); request/response schemas in packages/contracts/src; MCP server documented in the website docs. |
| sites_https | Met | GitHub repo, GitHub Pages site and ghcr.io are HTTPS only. |
| discussion | Met | GitHub Issues and GitHub Discussions (REPO/discussions): searchable, URL-addressable, no proprietary client needed. |
| english | Met | All docs, issues and code review are in English. |
| maintained | Met | Daily commits and merged PRs; Dependabot updates merged weekly. |

## Change control

| Criterion | Status | Justification |
| --- | --- | --- |
| repo_public | Met | REPO (public git repository). |
| repo_track | Met | Git history records author, date and message for every change; PRs keep the review discussion. |
| repo_interim | Met | All work lands on `main` through PRs between releases; feature branches are public. |
| repo_distributed | Met | Git. |
| version_unique | Met | Every release has a unique SemVer tag (v1.0.0); images are tagged by version and commit SHA. |
| version_semver | Met | SemVer, managed by release-please (.github/workflows/release-please.yml). |
| version_tags | Met | Git tags `vX.Y.Z` per release (REPO/tags). |
| release_notes | Met | GitHub Releases (REPO/releases) generated from Conventional Commits, plus CHANGELOG.md. |
| release_notes_vulns | Met | Security fixes are released with a GitHub Security Advisory (CVE/GHSA ID) and listed in the release notes; policy in SECURITY.md ("Security Updates"). Status N/A is also acceptable if no release has fixed a publicly known vulnerability yet. |

## Reporting

| Criterion | Status | Justification |
| --- | --- | --- |
| report_process | Met | Bug reports via GitHub Issues with templates (REPO/tree/main/.github/ISSUE_TEMPLATE). |
| report_tracker | Met | GitHub Issues. |
| report_responses | Met | Maintainer triages and answers bug reports; most are fixed by a linked PR. |
| enhancement_responses | Met | Feature requests (feature_request.yml template) get a reply or a linked PR/discussion. |
| report_archive | Met | Issues and PRs are public and searchable: REPO/issues?q=is%3Aissue |
| vulnerability_report_process | Met | REPO/blob/main/.github/SECURITY.md |
| vulnerability_report_private | Met | GitHub private vulnerability reporting: REPO/security/advisories/new |
| vulnerability_report_response | Met | SECURITY.md commits to acknowledge within 48 hours and assess within 7 days; reports are handled in GitHub private advisory forks. |

## Quality

| Criterion | Status | Justification |
| --- | --- | --- |
| build | Met | `make quick-dev` / `docker compose up`; `npm run build` per package; Dockerfiles build the production images. |
| build_common_tools | Met | npm, Node.js, Vite, TypeScript, Docker, Make. |
| build_floss_tools | Met | All build tools are FLOSS. |
| test | Met | Backend: ~600 Vitest unit/e2e spec files (`npm --prefix backend run test`, `test:e2e`); frontend: ~400 Vitest test files; parsing golden tests. |
| test_invocation | Met | `npm test` at the root; documented in CONTRIBUTING ("Testing"). |
| test_most | Unmet | Coverage gate is low (backend thresholds 8% statements); the suite is broad but no claim of "most branches". Suggested only, does not block passing. |
| test_continuous_integration | Met | GitHub Actions on every PR and in the merge queue: lint, typecheck, unit, e2e (4 shards, real Postgres/Redis), golden, build (.github/workflows/ci.yml). |
| test_policy | Met | CONTRIBUTING: "Add tests if you've added code that should be tested"; PR template checklist. |
| tests_are_added | Met | Recent PRs add tests with the change (e.g. #450 path-guard and e-invoice tests, #449 property-based test). |
| tests_documented_added | Met | CONTRIBUTING "Pull Requests" step 4 and PR template. |
| warnings | Met | TypeScript `strict: true` (backend and frontend), Biome lint, ShellCheck, Hadolint, Conftest. |
| warnings_fixed | Met | CI fails on type errors and Biome errors; the file-size guard and contract sync also gate merges. |
| warnings_strict | Met | `strict` TypeScript; Biome recommended rules plus project rules; CI is check-only (no auto-fix). |

## Security

| Criterion | Status | Justification |
| --- | --- | --- |
| know_secure_design | Met | Maintainer applies documented secure-design rules: tenant isolation on every query, deny-by-default RBAC, egress guard for user URLs, CSRF double-submit, HttpOnly cookies (SECURITY.md "Known Security Considerations"). |
| know_common_errors | Met | OWASP Top 10 classes are covered by tests and CI: SSRF guard, path-traversal guard, CSV formula neutralisation, zip-bomb guard, rate limits, isolation sweep e2e over every route. |
| crypto_published | Met | Only published algorithms: AES-256-GCM, bcrypt, HMAC-SHA256, SHA-256, JWT (HS256). |
| crypto_call | Met | Uses Node.js `crypto`, `bcrypt`, `@nestjs/jwt`/`jsonwebtoken`; no home-grown crypto. |
| crypto_floss | Met | All crypto is FLOSS (OpenSSL via Node.js, bcrypt). |
| crypto_keylength | Met | AES-256 keys; secrets generated with `openssl rand -base64 32` (SECURITY.md); bcrypt cost 12. |
| crypto_working | Met | No broken algorithms (no MD5/SHA-1/DES/RC4 for security). |
| crypto_weaknesses | Met | No SHA-1 or CBC-without-MAC; GCM gives authenticated encryption. |
| crypto_pfs | N/A | The app does not terminate TLS; deployments put it behind a reverse proxy, which negotiates TLS (README/SECURITY.md recommend HTTPS). |
| crypto_password_storage | Met | Passwords hashed with bcrypt (backend/src/common/utils/password-hash.util.ts, `BCRYPT_ROUNDS`, default 12); reset tokens stored only as HMAC. |
| crypto_random | Met | Keys, IVs and tokens come from `crypto.randomBytes`/`randomUUID` (CSPRNG); `Math.random` is not used for security. |
| delivery_mitm | Met | Code and images are delivered over HTTPS (GitHub, ghcr.io); images are signed with cosign and carry SLSA provenance and SBOM attestations (.github/workflows/cd.yml). |
| delivery_unsigned | Met | No hash is fetched over HTTP; dependency lockfiles carry integrity hashes, Python deps install with `--require-hashes`. |
| vulnerabilities_fixed_60_days | Met | No publicly known medium+ vulnerability unpatched for more than 60 days; Dependabot and npm audit run continuously, OSV exceptions are justified in `osv-scanner.toml`. |
| vulnerabilities_critical_fixed | Met | Critical vulnerabilities are fixed in a private advisory fork and shipped in a release together with the published advisory (SECURITY.md "Disclosure Policy"). |
| no_leaked_credentials | Met | No credentials in the repo: `.env` is git-ignored, gitleaks runs in CI, GitHub secret scanning and push protection are enabled. |

## Analysis

| Criterion | Status | Justification |
| --- | --- | --- |
| static_analysis | Met | CodeQL on every PR and push (.github/workflows/codeql.yml), SonarCloud, Biome, Trivy config scan, Hadolint, ShellCheck, OpenSSF Scorecard. |
| static_analysis_common_vulnerabilities | Met | CodeQL `javascript` security queries (injection, path traversal, XSS, prototype pollution). |
| static_analysis_fixed | Met | Medium+ findings are fixed promptly: all 15 open CodeQL alerts fixed in #450; the merge ruleset blocks new high+ code-scanning alerts. |
| static_analysis_often | Met | Every PR, the merge queue, every push to main, plus a weekly scheduled run. |
| dynamic_analysis | Met | E2E suite drives the running API against real Postgres/Redis, including a cross-tenant isolation sweep over every route; property-based tests with fast-check; Trivy scans the built images. |
| dynamic_analysis_unsafe | N/A | Written in TypeScript (memory-safe); no C/C++ code of our own. |
| dynamic_analysis_enable_assertions | Met | Tests run with assertions enabled; outside production the response-contract check turns any schema drift into a 500 that e2e catches, and the leak guard fails any response that exposes file internals or account details. |
| dynamic_analysis_fixed | Met | Failures found by the e2e/isolation sweep block the merge and are fixed before release. |
