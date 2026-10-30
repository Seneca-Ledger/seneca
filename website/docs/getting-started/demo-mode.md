---
title: Demo Mode
description: Explore Stoic Budget with a demo account
---

Stoic Budget ships a demo account so you can log in and explore right away.

## Create the demo account

`make quick-dev` and the `npm run setup:dev*` scripts create it for you. To create it again:

```bash
make seed-demo
```

The seed creates a regular user and a workspace they own, with the default categories, tax rates
and balance accounts. It adds no statements or transactions — upload a file to see the dashboard
and reports fill in. Running it again resets the demo password.

## Demo credentials

- Email: `demo@seneca.dev`
- Password: `demo123`

## What to try

- Upload a statement file from the Statements page
- Review the import preview and resolve any duplicates
- Open the Dashboard and Reports once transactions are in
- Browse the Audit Log to see change history

Next: [Importing Statements](../guides/importing-statements)
