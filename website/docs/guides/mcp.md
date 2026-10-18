---
title: MCP and API keys
description: Let Claude Code, Claude Desktop or your own scripts work on a workspace, within scopes, with every write audited and undoable
---

Lumio ships an MCP server (`mcp-server/`) that exposes a workspace to any MCP client. It talks to
the backend with an **API key**, so what it can do is exactly what the key's **scopes** allow.

## Create a key

In the app open the **MCP server** panel (top bar) and create a key. Pick what it may do:

- **Read only** — every `*.view` and `*.export` permission. Enough for analysis, reports, questions.
- **Read and write** — everything a key may hold: upload statements, edit transactions and
  categories, manage budgets, payables, invoices.
- **Choose by hand** — tick individual permissions (`transaction.view`, `statement.upload`, …).

A key is never wider than the role of the person who made it, and some permissions are never granted
to keys at all: managing keys, people, workspace settings or integrations. The full key is shown once.

API: `POST /api-keys { name, scopes[], expiresAt? }`, `GET /api-keys/scopes` for the list and presets,
`GET /api-keys`, `DELETE /api-keys/:id`. Keys created before scopes existed carry `scopes: null` and
keep their owner's full reach; recreate them with scopes to narrow them.

## Connect a client

Build the server once:

```bash
cd mcp-server && npm install && npm run build
```

Claude Desktop (`claude_desktop_config.json`) or Claude Code (`.mcp.json` in a project):

```json
{
  "mcpServers": {
    "lumio": {
      "command": "node",
      "args": ["/path/to/lumio/mcp-server/dist/index.js"],
      "env": {
        "LUMIO_BASE_URL": "https://your-lumio/api/v1",
        "LUMIO_API_KEY": "lum_…",
        "LUMIO_WORKSPACE_ID": "<workspace uuid>"
      }
    }
  }
}
```

With Claude Code you can also register it from the terminal:

```bash
claude mcp add lumio -e LUMIO_BASE_URL=https://your-lumio/api/v1 -e LUMIO_API_KEY=lum_… -e LUMIO_WORKSPACE_ID=<uuid> -- node /path/to/lumio/mcp-server/dist/index.js
```

The server offers tools for transactions, categories, statements, the dashboard, classification,
data entry and webhooks, plus resources for categories, transactions and the dashboard. A tool
outside the key's scopes answers with `403 API key scope missing: …`.

## What an agent does is on the record

Every write made through an API key is an audit event with the actor **Integration** and the key's
name and prefix in the label (`API key "Claude Code" (ab12cd34)`), the user it acted for in
`meta.onBehalfOfUserId`, and **Undo** available wherever rollback knows the entity (transactions,
statements, categories, custom tables, workspace settings). Filter the activity log by actor
**Integration** to review it.

See also [Security posture](security-posture).
