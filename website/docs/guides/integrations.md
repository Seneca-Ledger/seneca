---
title: Integrations
description: Mail, storage, inbox, bank sync and Telegram
---

Integrations are configured in the app under **Integrations**, per workspace. Secrets are stored
encrypted. Env variables with the same purpose are only temporary fallback defaults for bootstrap.

## Catalog

| Integration | What it does |
|---|---|
| Local categorization | Installs a local Transformers.js model on the server — see [Categorization](categorization) |
| SMTP email | Sends workspace invitations, password reset links and email change confirmations |
| App URL | The public URL used in invitations and shared links |
| S3-compatible storage | Syncs statements with a bucket such as MinIO |
| WebDAV storage | Imports and syncs files from Nextcloud or another WebDAV server |
| IMAP inbox | Polls a mailbox for receipts and invoice attachments |
| Bank sync via SimpleFIN | Pulls statements from your own SimpleFIN Bridge account through the regular import — see below |
| Telegram | Scheduled reports to a chat or channel; set up in **Settings → Telegram** |

## Notes

- Endpoints and hosts saved here (SMTP, S3, WebDAV, IMAP, SimpleFIN) must resolve to public addresses: the
  egress guard rejects private and loopback hosts when you save and again on every connection. An
  SMTP relay on a private network goes in `SMTP_HOST`/`SMTP_FROM` on the server instead.
- Without SMTP, invitation links are still returned by the API, but password reset and email
  change cannot complete — their links travel only by email.
- The Telegram webhook needs `TELEGRAM_WEBHOOK_SECRET` on the backend.
- There is no Gmail, Google Drive or Dropbox integration: mail receipts come in over IMAP, files through
  S3-compatible storage or WebDAV.
- Receipt maps use self-hosted services configured through env, not the catalog — see
  [Receipt Maps](receipt-maps).

## Bank sync via SimpleFIN

Seneca holds no bank integration of its own. What it offers is a connector for an aggregator
account you hold yourself: [SimpleFIN Bridge](https://bridge.simplefin.org) (a paid service from
SimpleFIN, North America) exposes your bank accounts over the open
[SimpleFIN protocol](https://www.simplefin.org/protocol.html), and Seneca pulls from it.

1. In SimpleFIN Bridge, connect your bank and create a **new connection**; it shows a *setup token*.
2. In Seneca, open **Integrations → Bank sync via SimpleFIN**, paste the token and connect. A token
   works once: Seneca exchanges it for an access credential and stores only that, encrypted.
3. Choose which accounts to pull and, optionally, which Seneca wallet each one lands in. Accounts the
   provider adds later start switched off.
4. **Pull now**, or leave *Pull automatically every 6 hours* on.

Each pull writes the new rows of an account as an OFX statement and hands it to the regular
statement import, so dedupe, rules, the review inbox and the audit log behave exactly as for a file
you upload. The first pull reaches 90 days back; later pulls overlap the previous one by a week, and
a row whose provider id is already in the workspace is never imported twice. Pending transactions
are skipped until they post. If the provider rejects the stored credential, the integration shows
*Needs a new token*; disconnecting deletes the credential and keeps the imported statements.

The claim URL and the access URL go through the same egress guard as every other integration host.

Next: [Categorization](categorization)
