# Secret Rotation Checklist

Use this checklist after a local secret scan or workstation exposure. Do not paste secret values into tickets, commits, logs, or scan reports.

## Rotate Immediately

- Google OAuth client secrets and Google API keys used by the frontend.
- Gemini or other AI provider API keys.
- Google Drive OAuth secrets.
- Integration encryption keys and state-signing secrets.
- TrueLayer client secrets.
- Resend or SMTP provider API keys.
- Backend JWT, refresh-token, and database credentials when local files may have been copied or exposed.

## After Rotation

- Revoke the old values in each provider console rather than only replacing local files.
- Check provider audit logs for unexpected usage before and after rotation.
- Replace local `.env` files with freshly generated values and keep them ignored by git.
- Re-run a secret scan and verify that reports redact values.
- If a production key may have been present locally, rotate dependent sessions/tokens as well.

## Prevention

- Keep `.env*`, `backend/.env*`, and `frontend/.env*` ignored except example files.
- Use generated secrets: `openssl rand -base64 32`.
- Keep production secrets in the deployment secret store, not in Compose files or local shell history.
