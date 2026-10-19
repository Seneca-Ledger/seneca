---
title: Security posture
description: Threat model, what is encrypted, what leaves your server and how to turn it off
---

Seneca is self-hosted: your bank statements, receipts and categories stay on your server. This page
says plainly what the app protects against, what it encrypts, what it sends anywhere and how to
turn the outbound parts off.

## Threat model

| We defend against | How |
|---|---|
| Another workspace's member reading your data | Every query filters by `workspaceId`; tenant isolation is tested end to end |
| A stolen session cookie | Short-lived JWT in an `HttpOnly` cookie, refresh rotation, CSRF guard on every mutating route, 2FA with recovery codes |
| An over-reaching script or AI agent | API keys carry scopes; a key never exceeds its owner's role; every write is audited as the key and is undoable |
| The server being used to reach your network | The egress guard rejects private, loopback and link-local hosts for every outbound URL (SMTP, S3, WebDAV, IMAP, prices, maps) |
| Uploaded files executing anything | Files are stored, never served as scripts; parsers run on text extracted from them |

We do not defend against an administrator of the host itself, a compromised database backup stored
in clear, or a browser extension reading the page.

## What is encrypted

- Passwords: bcrypt hashes. API keys: SHA-256 hashes, the raw key is shown once and never stored.
- Integration secrets (SMTP, S3, WebDAV, IMAP, Telegram): encrypted at rest with
  the server's `INTEGRATIONS_ENCRYPTION_KEY`.
- 2FA secrets and recovery codes: encrypted / hashed.
- Transport: run behind TLS; the cookie is `Secure` in production.
- Statements and receipts on disk are not encrypted by the app; use disk encryption and encrypted
  backups on the host.

## What leaves your server, and when

| Destination | Sent | When | Off switch |
|---|---|---|---|
| Exchange-rate provider | Currency pairs and dates | Multi-currency totals | Single currency, or set rates by hand |
| Stooq / CoinGecko | Tickers | "Refresh prices" on the net-worth page | Enter prices by hand |
| Your map tile server / Nominatim | Receipt coordinates | Receipt maps, if enabled | Do not enable receipt location |
| Telegram | Reports and replies to the bot | Only if the bot is connected | Disconnect Telegram |
| SMTP | Invitations, password resets | Only if SMTP is set | Leave SMTP unset |

Nothing is sent to Seneca's authors. There is no telemetry.

No external LLM is ever contacted. Statement parsing and categorisation run on your server:
parsers are deterministic, categories come from your rules, your corrections and payee history,
and local categorisation (Transformers.js) loads its model from uploaded files and sends nothing
out.

## Agents, keys and the record

See [MCP and API keys](mcp): scopes per key, the `Integration` actor in the activity
log, undo on every write rollback understands.

## Reporting a problem

Open a private security advisory on the GitHub repository. Please do not file public issues for
vulnerabilities.
