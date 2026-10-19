# Security allowlists

These allowlists document temporary exceptions used by CI gates. Review them regularly and remove once upstream fixes are available.

## Dependency vulnerabilities

Configured in `backend/audit-ci.json` and used by `dependency-scan` job:

- `GHSA-vwc7-r8mq-g2x9` (adm-zip) — expires 2026-12-10. Extraction follows
  destination symlinks; no patched release exists upstream. Not reachable here:
  the affected APIs (`extractAllTo`/`extractEntryTo`) are never called. The three
  consumers are `backups/backup-archive.service.ts`, `parsing/parsers/docx.parser.ts`
  and `application-settings/application-settings.service.ts`, the last of which
  validates entry paths itself and writes via `fs.writeFile`. Also reached
  transitively through `onnxruntime-node`.

The previous entries (`GHSA-cf4h-3jhx-xvhq` underscore, `GHSA-h6q6-9hqw-rwfv` /
`GHSA-crh6-fp67-6883` / `GHSA-5fg8-2547-mr8q` xmldom, both via `pdf2json`; and
`GHSA-4r6h-8v6p-xvw6` / `GHSA-5pgg-2g8v-p4x9` xlsx) were removed in the 2026-09
dependency cleanup: `pdf2json` is no longer in any lockfile, and `xlsx` is
installed from the SheetJS CDN tarball at 0.20.3, which is past both advisories.

Note the format: audit-ci 7.x only accepts `allowlist` and boolean severity keys
(`"moderate": true`), and each allowlist entry needs `"active": true` — an entry
with only `notes` and `expiry` is silently inert. Unknown keys are dropped without
warning: the old file used `severity` and `allowlistedAdvisories`, both invalid,
so every threshold defaulted to `false` and the gate passed unconditionally. The
CI step also passed `--path backend` (not a real flag) instead of `--directory
backend`, so it audited the repo root rather than the backend tree. The `$schema`
reference in `backend/audit-ci.json` makes the config half of that visible in an
editor.

The backend gate runs at `moderate` and above so the adm-zip entry above is
load-bearing rather than decorative; audit-ci prints `Found vulnerable
allowlisted advisories` on each run, and the build starts failing once the
expiry passes.

## License exceptions

`dependency-scan` runs license checks for dependencies in all npm package roots, including dev dependencies. The allowlist only permits open-source licenses and intentionally excludes `UNLICENSED` dependency packages.

- `@img/sharp-libvips-*` (LGPL) required by `sharp`/Next.js image processing.

If licensing requirements change, adjust the `ALLOWED_LICENSES` string in `.github/workflows/ci.yml` and tighten/remove these exceptions.
