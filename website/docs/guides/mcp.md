---
title: MCP and API keys
description: Let Claude Code, Claude Desktop or your own scripts work on a workspace, within scopes, with every write audited and undoable
---

Seneca has an MCP endpoint built into the backend: `/api/v1/mcp` (Streamable HTTP, stateless).
Any MCP client connects to it with an **API key**, so what an agent can do is exactly what the key's
**scopes** allow, inside the one workspace the key belongs to.

## Switch MCP on

MCP is a plugin: open **Plugins** in the sidebar and switch **MCP Server** on. Only owners and
admins of the workspace can. While it is off the endpoint answers `403 PLUGIN_DISABLED`; the same
keys keep working against the REST API for scripts.

## Create a key

In **Plugins → MCP Server** create a key. Pick what it may do:

- **Read only** — every `*.view` and `*.export` permission. Enough for analysis, reports, questions.
- **Read and write** — everything a key may hold: upload statements, edit transactions and
  categories, manage budgets, payables, invoices.
- **Choose by hand** — tick individual permissions (`transaction.view`, `statement.upload`, …).

Creating keys takes the instance admin role. A key is never wider than the role of the person who
made it (a workspace viewer's key reads, whatever its scopes say), and some permissions are never
granted to keys at all: managing keys, people, workspace settings or integrations. The full key is
shown once, and it works only in the workspace it was made in.

API: `POST /api-keys { name, scopes[], expiresAt? }`, `GET /api-keys/scopes` for the list and presets,
`GET /api-keys`, `DELETE /api-keys/:id`. Keys created before scopes existed carry `scopes: null` and
keep their owner's full reach; recreate them with scopes to narrow them.

## Connect a client

The endpoint needs only its URL and the key in the `X-Api-Key` header. The MCP Server panel shows
both, ready to copy.

Claude Code:

```bash
claude mcp add --transport http seneca https://your-seneca/api/v1/mcp --header "X-Api-Key: lum_…"
```

A client that reads a JSON config (`.mcp.json` in a project, Cursor, …):

```json
{
  "mcpServers": {
    "seneca": {
      "type": "http",
      "url": "https://your-seneca/api/v1/mcp",
      "headers": { "X-Api-Key": "lum_…" }
    }
  }
}
```

A client that only starts local (stdio) servers, such as Claude Desktop, reaches it through
[`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```json
{
  "mcpServers": {
    "seneca": {
      "command": "npx",
      "args": ["mcp-remote", "https://your-seneca/api/v1/mcp", "--header", "X-Api-Key:${SENECA_KEY}"],
      "env": { "SENECA_KEY": "lum_…" }
    }
  }
}
```

## Tools

`tools/list` shows a key only the tools its scopes and its owner's role allow; each asks for the
same permission as the REST route it stands in for.

| Area | Tools |
|---|---|
| Transactions | `list_transactions`, `get_transaction`, `update_transaction`, `set_transactions_category` |
| Categories | `list_categories`, `create_category`, `update_category` |
| Documents | `list_statements`, `get_statement`, `upload_statement`, `upload_receipt`, `search` |
| Review | `get_review_counts`, `list_review_inbox`, `approve_transactions` |
| Receipts | `list_receipts`, `get_receipt`, `approve_receipt` |
| Planning | `list_budgets`, `get_stoic_balance`, `create_budget`, `list_goals`, `get_forecast` |
| Wealth | `get_net_worth`, `list_wallets` |
| Pay/Receive | `list_invoices`, `get_invoice_ageing`, `list_payables`, `get_payables_summary` |
| Recurring | `list_subscriptions`, `get_subscriptions_summary`, `get_upcoming_charges`, `list_payees` |
| Tax | `get_tax_deadlines`, `get_tax_year_report` |
| Overview | `get_dashboard`, `get_trends`, `list_insights` |

Agents only change what can be taken back: nothing deletes, pays, or confirms a detected
subscription. Arguments a tool does not take are refused rather than ignored. Answers leave out file
paths, hashes and account details, as REST answers do, and a long answer is cut with a hint to narrow
the filters. Uploads travel as base64 inside the JSON request, so a file can be about 700 KB at most.

## What an agent does is on the record

Every write made through an API key is an audit event with the actor **Integration** and the key's
name and prefix in the label (`API key "Claude Code" (ab12cd34)`), the user it acted for in
`meta.onBehalfOfUserId`, and **Undo** available wherever rollback knows the entity (transactions,
statements, categories, custom tables, workspace settings). Filter the activity log by actor
**Integration** to review it.

See also [Security posture](security-posture).
